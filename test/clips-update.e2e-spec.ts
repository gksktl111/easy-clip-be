import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrometheusMetricsService } from '../src/shared/infrastructure/prometheus/prometheus-metrics.service';
import { JwtAccessGuard } from '../src/shared/presentation/guards/jwt-access.guard';
import { CLIP_IMAGE_STORAGE_PORT } from '../src/shared/application/ports/clip-image-storage.port';
import { MulterFile } from '../src/shared/types/multer-file.type';
import { PrismaClipsRepository } from '../src/clips/infrastructure/prisma-clips.repository';
import { UpdateClipUseCase } from '../src/clips/application/usecases/update-clip.usecase';

describe('Clip content updates (PostgreSQL integration)', () => {
  let prisma: PrismaService;
  let second: PrismaService;
  let repository: PrismaClipsRepository;
  let secondRepository: PrismaClipsRepository;
  let app: INestApplication<App>;
  let userId: string;
  let workspaceId: string;
  let folderId: string;
  let otherFolderId: string;
  let clipId: string;
  let oldImage: string;
  const objects = new Set<string>();
  const storage = {
    uploadImage: jest.fn(() => {
      const url = `https://test.invalid/${randomUUID()}.png`;
      objects.add(url);
      return Promise.resolve({ key: url, url });
    }),
    deleteImage: jest.fn((url: string) => {
      objects.delete(url);
      return Promise.resolve();
    }),
  };
  const file = {
    originalname: 'image.png',
    mimetype: 'image/png',
    size: 5,
    buffer: Buffer.from('image'),
  } as MulterFile;
  const useCase = (repo = repository) => new UpdateClipUseCase(repo, storage);
  const row = () => prisma.clip.findUniqueOrThrow({ where: { id: clipId } });

  beforeAll(async () => {
    if (
      !process.env.DATABASE_URL ||
      new URL(process.env.DATABASE_URL).pathname !== '/test_db'
    ) {
      throw new Error('Requires isolated test_db');
    }
    const metrics = {
      observeDatabaseQuery: jest.fn(),
    } as unknown as PrometheusMetricsService;
    prisma = new PrismaService(metrics);
    second = new PrismaService(metrics);
    await Promise.all([prisma.$connect(), second.$connect()]);
    repository = new PrismaClipsRepository(prisma);
    secondRepository = new PrismaClipsRepository(second);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(CLIP_IMAGE_STORAGE_PORT)
      .useValue(storage)
      .overrideGuard(JwtAccessGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context
            .switchToHttp()
            .getRequest<{ user: { userId: string } }>().user = { userId };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(async () => {
    objects.clear();
    storage.uploadImage.mockClear();
    storage.deleteImage.mockClear();
    userId = randomUUID();
    workspaceId = randomUUID();
    folderId = randomUUID();
    otherFolderId = randomUUID();
    clipId = randomUUID();
    oldImage = `https://test.invalid/${randomUUID()}.png`;
    objects.add(oldImage);
    await prisma.user.create({
      data: {
        id: userId,
        ownedWorkspace: {
          create: {
            id: workspaceId,
            name: 'Clip test',
            folders: {
              create: [
                { id: folderId, name: 'Source', order: 0 },
                { id: otherFolderId, name: 'Other', order: 1 },
              ],
            },
          },
        },
      },
    });
    await prisma.clip.create({
      data: {
        id: clipId,
        workspaceId,
        folderId,
        type: 'IMAGE',
        title: 'old',
        imageUrl: oldImage,
      },
    });
    const tag = await prisma.tag.create({ data: { folderId, name: 'keep' } });
    await prisma.clipTag.create({ data: { clipId, tagId: tag.id } });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.user.deleteMany({ where: { id: userId } });
  });
  afterAll(async () => {
    await app?.close();
    await Promise.all([prisma?.$disconnect(), second?.$disconnect()]);
  });

  it('rejects folder/workspace input over HTTP and preserves membership and tags', async () => {
    for (const body of [
      { folderId: otherFolderId },
      { folderId },
      { workspaceId },
    ]) {
      await request(app.getHttpServer())
        .patch(`/clips/${clipId}`)
        .send({ ...body, text: 'new' })
        .expect(400);
    }
    expect(await row()).toMatchObject({
      folderId,
      workspaceId,
      imageUrl: oldImage,
    });
    expect(await prisma.clipTag.count({ where: { clipId } })).toBe(1);
    await request(app.getHttpServer())
      .patch(`/clips/${clipId}`)
      .send({ text: '#fff' })
      .expect(200);
    expect(await row()).toMatchObject({
      folderId,
      workspaceId,
      type: 'COLOR',
      imageUrl: null,
    });
    expect(await prisma.clipTag.count({ where: { clipId } })).toBe(1);
  });

  it('rejects an empty HTTP update while image replacement proceeds without rewriting old data', async () => {
    const [, updated] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/clips/${clipId}`)
        .send({})
        .expect(400),
      useCase().execute(userId, { clipId }, file),
    ]);
    expect((await row()).imageUrl).toBe(updated.imageUrl);
    expect(objects).toEqual(new Set([updated.imageUrl]));
  });

  it('serializes two stale image edits and deletes the actual replaced objects', async () => {
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    let count = 0;
    for (const repo of [repository, secondRepository]) {
      const original = repo.findClipByIdForUser.bind(
        repo,
      ) as PrismaClipsRepository['findClipByIdForUser'];
      jest
        .spyOn(repo, 'findClipByIdForUser')
        .mockImplementationOnce(async (...args) => {
          const previous = await original(...args);
          count += 1;
          if (count === 2) release();
          await bothRead;
          return previous;
        });
    }
    await Promise.all([
      useCase().execute(userId, { clipId }, file),
      useCase(secondRepository).execute(userId, { clipId }, file),
    ]);
    const current = await row();
    expect(current).toMatchObject({ folderId, workspaceId });
    expect(objects).toEqual(new Set([current.imageUrl]));
    expect(storage.deleteImage).toHaveBeenCalledTimes(2);
    expect(await prisma.clipTag.count({ where: { clipId } })).toBe(1);
  });

  it('cleans the new upload after an actual database write rollback', async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Clip" ADD CONSTRAINT "clip_149_test_reject" CHECK ("id" <> '${clipId}') NOT VALID`,
    );
    try {
      await expect(
        useCase().execute(userId, { clipId }, file),
      ).rejects.toThrow();
      expect((await row()).imageUrl).toBe(oldImage);
      expect(objects).toEqual(new Set([oldImage]));
      expect(storage.deleteImage).toHaveBeenCalledTimes(1);
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Clip" DROP CONSTRAINT "clip_149_test_reject"',
      );
    }
  });

  it('preserves an uploaded image when the committed write response is lost', async () => {
    const original = repository.updateClip.bind(
      repository,
    ) as PrismaClipsRepository['updateClip'];
    jest
      .spyOn(repository, 'updateClip')
      .mockImplementationOnce(async (...args) => {
        await original(...args);
        throw new Error('write response lost');
      });
    await expect(useCase().execute(userId, { clipId }, file)).rejects.toThrow(
      'write response lost',
    );
    const current = await row();
    expect(current.imageUrl).not.toBe(oldImage);
    expect(objects.has(current.imageUrl!)).toBe(true);
    expect(storage.deleteImage).not.toHaveBeenCalled();
  });

  it('cleans an upload when the clip is deleted after the initial read', async () => {
    const original = repository.updateClip.bind(
      repository,
    ) as PrismaClipsRepository['updateClip'];
    jest
      .spyOn(repository, 'updateClip')
      .mockImplementationOnce(async (...args) => {
        await second.clip.update({
          where: { id: clipId },
          data: { deletedAt: new Date() },
        });
        return original(...args);
      });
    await expect(
      useCase().execute(userId, { clipId }, file),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await row()).imageUrl).toBe(oldImage);
    expect(objects).toEqual(new Set([oldImage]));
  });
});
