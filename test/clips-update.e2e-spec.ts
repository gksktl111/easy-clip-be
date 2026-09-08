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

  it('renames over HTTP without replacing content, membership or tags', async () => {
    const before = await row();
    await request(app.getHttpServer())
      .patch(`/clips/${clipId}`)
      .send({ title: '새 이미지 이름' })
      .expect(200);
    expect(await row()).toMatchObject({
      title: '새 이미지 이름',
      type: before.type,
      textContent: before.textContent,
      colorHex: before.colorHex,
      imageUrl: before.imageUrl,
      folderId,
      workspaceId,
    });
    expect(await prisma.clipTag.count({ where: { clipId } })).toBe(1);
    expect(storage.uploadImage).not.toHaveBeenCalled();
    expect(storage.deleteImage).not.toHaveBeenCalled();
    for (const title of ['', '   ', null, 123]) {
      await request(app.getHttpServer())
        .patch(`/clips/${clipId}`)
        .send({ title })
        .expect(400);
    }
    expect((await row()).title).toBe('새 이미지 이름');
  });

  it('validates title length after trimming over JSON and multipart', async () => {
    for (const title of ['가'.repeat(15), '😀'.repeat(15)]) {
      await request(app.getHttpServer())
        .patch(`/clips/${clipId}`)
        .send({ title: ` ${title} ` })
        .expect(200);
      expect((await row()).title).toBe(title);
      await request(app.getHttpServer())
        .patch(`/clips/${clipId}`)
        .field('title', ` ${title} `)
        .expect(200);
      expect((await row()).title).toBe(title);
    }
    const before = await row();
    for (const title of ['가'.repeat(16), '😀'.repeat(16), '   ']) {
      await request(app.getHttpServer())
        .patch(`/clips/${clipId}`)
        .send({ title: ` ${title} ` })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/clips/${clipId}`)
        .field('title', ` ${title} `)
        .expect(400);
    }
    expect(await row()).toEqual(before);
    expect(storage.uploadImage).not.toHaveBeenCalled();
    expect(storage.deleteImage).not.toHaveBeenCalled();
  });

  it('preserves an image replaced between the rename read and write', async () => {
    const original = repository.updateClip.bind(
      repository,
    ) as PrismaClipsRepository['updateClip'];
    let replacedUrl: string | null = null;
    jest
      .spyOn(repository, 'updateClip')
      .mockImplementationOnce(async (...args) => {
        const replaced = await useCase(secondRepository).execute(
          userId,
          { clipId },
          file,
        );
        replacedUrl = replaced.imageUrl;
        return original(...args);
      });
    const renamed = await useCase().execute(userId, {
      clipId,
      title: '동시 변경 이름',
    });
    expect(replacedUrl).not.toBe(oldImage);
    expect(renamed).toMatchObject({
      title: '동시 변경 이름',
      imageUrl: replacedUrl,
      type: 'IMAGE',
    });
    expect((await row()).imageUrl).toBe(replacedUrl);
    expect(objects).toEqual(new Set([replacedUrl]));
    expect(storage.deleteImage).toHaveBeenCalledTimes(1);
    expect(storage.deleteImage).toHaveBeenCalledWith(oldImage);
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
