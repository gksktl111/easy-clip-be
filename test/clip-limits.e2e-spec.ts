import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaClipsRepository } from '../src/clips/infrastructure/prisma-clips.repository';
import { PrismaTrashRepository } from '../src/trash/infrastructure/prisma-trash.repository';
import { PrometheusMetricsService } from '../src/shared/infrastructure/prometheus/prometheus-metrics.service';
import { JwtAccessGuard } from '../src/shared/presentation/guards/jwt-access.guard';
import { CLIP_IMAGE_STORAGE_PORT } from '../src/shared/application/ports/clip-image-storage.port';
import { ApplicationExceptionFilter } from '../src/shared/presentation/filters/application-exception.filter';

describe('Per-folder clip quotas (PostgreSQL integration)', () => {
  let prisma: PrismaService;
  let second: PrismaService;
  let clips: PrismaClipsRepository;
  let secondClips: PrismaClipsRepository;
  let trash: PrismaTrashRepository;
  let app: INestApplication<App>;
  let userId: string;
  let workspaceId: string;
  let folderId: string;
  let otherFolderId: string;
  const content = {
    type: 'TEXT' as const,
    title: 'quota test',
    textContent: 'quota test',
    colorHex: null,
    imageUrl: null,
  };
  const storage = {
    uploadImage: jest.fn(() => Promise.reject(new Error('Unexpected upload'))),
    deleteImage: jest.fn(() => Promise.resolve()),
  };
  const create = (repository = clips, target = folderId) =>
    repository.createClip(userId, {
      ...content,
      folderId: target,
      workspaceId,
    });
  const count = (target = folderId) =>
    prisma.clip.count({ where: { folderId: target, deletedAt: null } });
  const seed = async (amount: number, target = folderId, deleted = false) => {
    const ids = Array.from({ length: amount }, () => randomUUID());
    await prisma.clip.createMany({
      data: ids.map((id) => ({
        ...content,
        id,
        folderId: target,
        workspaceId,
        deletedAt: deleted ? new Date() : null,
      })),
    });
    return ids;
  };
  const subscribe = (
    plan: SubscriptionPlan,
    status: SubscriptionStatus = 'ACTIVE',
    currentPeriodEnd: Date | null = new Date(Date.now() + 86_400_000),
    autoRenew = false,
  ) =>
    prisma.subscription.upsert({
      where: { workspaceId },
      create: { workspaceId, plan, status, currentPeriodEnd, autoRenew },
      update: { plan, status, currentPeriodEnd, autoRenew },
    });
  const limitError = (
    limit: number,
    currentCount: number,
    target = folderId,
  ) => ({
    code: 'CONFLICT',
    policyCode: 'CLIP_LIMIT_EXCEEDED',
    details: {
      resource: 'clips',
      folderId: target,
      limit,
      currentCount,
      requestedIncrease: 1,
      upgradeCanResolve: limit === 50 && currentCount + 1 <= 300,
    },
  });
  const expectOneWinner = (results: PromiseSettledResult<unknown>[]) => {
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject(limitError(50, 50));
  };

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
    clips = new PrismaClipsRepository(prisma);
    secondClips = new PrismaClipsRepository(second);
    trash = new PrismaTrashRepository(second);
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
    app.useGlobalFilters(new ApplicationExceptionFilter());
    await app.init();
  });
  beforeEach(async () => {
    userId = randomUUID();
    workspaceId = randomUUID();
    folderId = randomUUID();
    otherFolderId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        ownedWorkspace: {
          create: {
            id: workspaceId,
            name: 'Quota test',
            folders: {
              create: [
                { id: folderId, name: 'First', order: 0 },
                { id: otherFolderId, name: 'Second', order: 1 },
              ],
            },
          },
        },
      },
    });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.user.deleteMany({ where: { id: userId } });
  });
  afterAll(async () => {
    await app?.close();
    await Promise.all([prisma?.$disconnect(), second?.$disconnect()]);
  });

  it.each([
    ['FREE', 50],
    ['PRO', 300],
  ] as const)(
    '%s permits the final slot and rejects the next creation with quota details',
    async (plan, limit) => {
      await subscribe(plan);
      await seed(limit - 1);
      await create();
      await expect(create()).rejects.toMatchObject(limitError(limit, limit));
      expect(await count()).toBe(limit);
      // The quota belongs to each folder, not the total workspace.
      if (plan === 'PRO') {
        await create(clips, otherFolderId);
        expect(await count(otherFolderId)).toBe(1);
      } else {
        await expect(create(clips, otherFolderId)).rejects.toMatchObject({
          policyCode: 'PROJECT_LOCKED',
        });
        expect(await count(otherFolderId)).toBe(0);
      }
    },
  );

  it('treats expired auto-renewing Pro as Free and retains all existing rows', async () => {
    await subscribe('PRO', 'ACTIVE', new Date(Date.now() - 60_000), true);
    await seed(50);
    await expect(create()).rejects.toMatchObject(limitError(50, 50));
    expect(await count()).toBe(50);
  });

  it('retains Pro quota through the paid period after cancellation', async () => {
    await subscribe('PRO', 'CANCELED');
    await seed(299);
    await create();
    await expect(create()).rejects.toMatchObject(limitError(300, 300));
    expect(await count()).toBe(300);
  });

  it('creates a missing Free subscription and permits only one of two competing creations', async () => {
    await seed(49);
    const results = await Promise.allSettled([create(), create(secondClips)]);
    expectOneWinner(results);
    expect(await count()).toBe(50);
    expect(await prisma.subscription.count({ where: { workspaceId } })).toBe(1);
  });

  it('permits only one of creation and restoration competing for the last Free slot', async () => {
    await subscribe('FREE');
    await seed(49);
    const [deletedId] = await seed(1, folderId, true);
    const results = await Promise.allSettled([
      create(),
      trash.restoreItems({ userId, folderIds: [], clipIds: [deletedId] }),
    ]);
    expectOneWinner(results);
    expect(await count()).toBe(50);
    const restored = await prisma.clip.findUniqueOrThrow({
      where: { id: deletedId },
    });
    expect(restored.deletedAt === null).toBe(results[1].status === 'fulfilled');
    expect(await prisma.clip.count({ where: { folderId } })).toBe(
      results[0].status === 'fulfilled' ? 51 : 50,
    );
  });

  it('rolls back a mixed folder/clip restoration when one folder exceeds its quota', async () => {
    await subscribe('PRO');
    await seed(300);
    const [fullFolderClip] = await seed(1, folderId, true);
    await seed(10, otherFolderId);
    const [otherClip] = await seed(1, otherFolderId, true);
    await prisma.folder.update({
      where: { id: otherFolderId },
      data: { deletedAt: new Date() },
    });
    await expect(
      trash.restoreItems({
        userId,
        folderIds: [otherFolderId],
        clipIds: [otherClip, fullFolderClip],
      }),
    ).rejects.toMatchObject(limitError(300, 300));
    const rows = await prisma.clip.findMany({
      where: { id: { in: [otherClip, fullFolderClip] } },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.deletedAt !== null)).toBe(true);
    expect(
      (await prisma.folder.findUniqueOrThrow({ where: { id: otherFolderId } }))
        .deletedAt,
    ).not.toBeNull();
    expect(await count()).toBe(300);
  });

  it.each([
    ['FREE', 50, 200],
    ['PRO', 300, 350],
  ] as const)(
    '%s restores an existing %i-limit folder with %i clips but rejects additional deleted clips',
    async (plan, limit, existing) => {
      await subscribe(plan);
      // Establish the Free choice before deletion; restoring this folder preserves it.
      await clips.findPersonalFolderById(userId, folderId);
      await seed(existing);
      const [extraId] = await seed(1, folderId, true);
      await prisma.folder.update({
        where: { id: folderId },
        data: { deletedAt: new Date() },
      });
      await expect(
        trash.restoreItems({
          userId,
          folderIds: [folderId],
          clipIds: [extraId],
        }),
      ).rejects.toMatchObject(limitError(limit, existing));
      expect(
        (await prisma.folder.findUniqueOrThrow({ where: { id: folderId } }))
          .deletedAt,
      ).not.toBeNull();
      await trash.restoreItems({ userId, folderIds: [folderId], clipIds: [] });
      expect(
        (await prisma.folder.findUniqueOrThrow({ where: { id: folderId } }))
          .deletedAt,
      ).toBeNull();
      expect(await count()).toBe(existing);
      await expect(
        trash.restoreItems({ userId, folderIds: [], clipIds: [extraId] }),
      ).rejects.toMatchObject(limitError(limit, existing));
      expect(
        (await prisma.clip.findUniqueOrThrow({ where: { id: extraId } }))
          .deletedAt,
      ).not.toBeNull();
      expect(await count()).toBe(existing);
    },
  );

  it('keeps 200 existing clips editable and deletable after downgrade while blocking additions', async () => {
    await subscribe('PRO');
    const [clipId] = await seed(200);
    await subscribe('FREE');
    expect(await count()).toBe(200);
    const updated = await clips.updateClip(userId, clipId, {
      ...content,
      title: 'edited',
      textContent: 'edited',
    });
    expect(updated?.clip).toMatchObject({
      id: clipId,
      title: 'edited',
      folderId,
      workspaceId,
    });
    await expect(create()).rejects.toMatchObject(limitError(50, 200));
    await clips.softDeleteClip(userId, clipId);
    expect(await count()).toBe(199);
    expect(await prisma.clip.count({ where: { folderId } })).toBe(200);
    await expect(create()).rejects.toMatchObject(limitError(50, 199));
  });

  it('preserves a clip restored after expired purge candidate selection', async () => {
    await subscribe('FREE');
    const imageUrl = `https://test.invalid/${randomUUID()}.png`;
    const clip = await prisma.clip.create({
      data: {
        folderId,
        workspaceId,
        type: 'IMAGE',
        title: 'restored image',
        imageUrl,
        deletedAt: new Date('1899-01-01T00:00:00Z'),
      },
    });
    let intercepted = false;
    const delayedClient = prisma.$extends({
      query: {
        clip: {
          async findMany({ args, query }) {
            const candidates = await query(args);
            if (
              !intercepted &&
              candidates.some((candidate) => candidate.id === clip.id)
            ) {
              intercepted = true;
              // Candidate selection has completed, but the purge has not acquired
              // folder/clip locks yet. Restore through the independent connection.
              await trash.restoreItems({
                userId,
                folderIds: [],
                clipIds: [clip.id],
              });
            }
            return candidates;
          },
        },
      },
    });
    const purge = new PrismaTrashRepository(
      delayedClient as unknown as PrismaService,
    );
    const result = await purge.hardDeleteExpiredClips(
      new Date('1900-01-01T00:00:00Z'),
      1,
    );
    expect(intercepted).toBe(true);
    expect(result).toEqual({ deletedCount: 0, imageUrls: [] });
    expect(
      await prisma.clip.findUniqueOrThrow({ where: { id: clip.id } }),
    ).toMatchObject({ deletedAt: null, imageUrl, title: 'restored image' });
  });

  it('does not delete children or return their images for a stale restored folder selection', async () => {
    await subscribe('FREE');
    await clips.findPersonalFolderById(userId, folderId);
    const imageUrl = `https://test.invalid/${randomUUID()}.png`;
    const clip = await prisma.clip.create({
      data: {
        folderId,
        workspaceId,
        type: 'IMAGE',
        title: 'keep image',
        imageUrl,
      },
    });
    await prisma.folder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
    });
    const deleting = new PrismaTrashRepository(prisma);
    const selected = await deleting.findDeletedFoldersByIds(userId, [folderId]);
    expect(selected).toHaveLength(1);
    await trash.restoreItems({ userId, folderIds: [folderId], clipIds: [] });
    const result = await deleting.hardDeleteItems({
      userId,
      folderIds: selected.map((folder) => folder.id),
      clipIds: [],
    });
    expect(result).toEqual({
      clipsDeleted: 0,
      foldersDeleted: 0,
      totalDeleted: 0,
      imageUrls: [],
    });
    expect(
      (await prisma.folder.findUniqueOrThrow({ where: { id: folderId } }))
        .deletedAt,
    ).toBeNull();
    expect(
      await prisma.clip.findUniqueOrThrow({ where: { id: clip.id } }),
    ).toMatchObject({ folderId, deletedAt: null, imageUrl });
  });

  it('returns HTTP 403 with a policy code for locked folder content', async () => {
    const response = await request(app.getHttpServer())
      .get(`/clips?folderId=${otherFolderId}&type=ALL`)
      .expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      code: 'PROJECT_LOCKED',
    });
    const list = await request(app.getHttpServer()).get('/folders').expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: folderId, isLocked: false }),
        expect.objectContaining({ id: otherFolderId, isLocked: true }),
      ]),
    );
  });

  it('returns an actionable HTTP quota error without mutating the full folder', async () => {
    await subscribe('FREE');
    await seed(50);
    const response = await request(app.getHttpServer())
      .post('/clips')
      .send({ folderId, text: 'one too many' })
      .expect(409);
    expect(response.body).toMatchObject({
      statusCode: 409,
      code: 'CLIP_LIMIT_EXCEEDED',
      details: limitError(50, 50).details,
    });
    expect(await count()).toBe(50);
    expect(storage.uploadImage).not.toHaveBeenCalled();
    expect(storage.deleteImage).not.toHaveBeenCalled();
  });
});
