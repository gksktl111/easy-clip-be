import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaClipsRepository } from '../src/clips/infrastructure/prisma-clips.repository';
import { PrismaFoldersRepository } from '../src/folders/infrastructure/prisma-folders.repository';
import { PrometheusMetricsService } from '../src/shared/infrastructure/prometheus/prometheus-metrics.service';

const featureError = { code: 'FORBIDDEN', policyCode: 'FEATURE_NOT_AVAILABLE' };

describe('Free and Pro features (PostgreSQL and authenticated HTTP)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let second: PrismaService;
  let clips: PrismaClipsRepository;
  let folders: PrismaFoldersRepository;
  let userId: string;
  let workspaceId: string;
  let folderId: string;
  let lockedId: string;
  let clipId: string;
  let tagId: string;
  let cookie: string;
  let jwt: JwtService;
  let secret: string;
  const previousOrigin = process.env.CORS_ALLOWED_ORIGINS;
  const previousCookie = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME;
  const origin = 'https://features.example.test';
  const http = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
  ) =>
    request(app.getHttpServer())
      [method](path)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('x-csrf-protection', '1');
  const subscribe = (status: 'ACTIVE' | 'CANCELED', end: Date) =>
    prisma.subscription.update({
      where: { workspaceId },
      data: {
        plan: 'PRO',
        status,
        currentPeriodEnd: end,
        autoRenew: status === 'ACTIVE',
      },
    });
  const snapshot = async () => ({
    tags: await prisma.tag.findMany({
      where: { folder: { workspaceId } },
      orderBy: { id: 'asc' },
    }),
    links: await prisma.clipTag.findMany({
      where: { clip: { workspaceId } },
      orderBy: { tagId: 'asc' },
    }),
  });
  const forbidden = async (
    call: request.Test,
    code = 'FEATURE_NOT_AVAILABLE',
  ) => {
    const response = await call.expect(403);
    expect(response.body).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      message: expect.any(String) as unknown,
      code,
    });
  };

  beforeAll(async () => {
    if (
      !process.env.DATABASE_URL ||
      new URL(process.env.DATABASE_URL).pathname !== '/test_db'
    ) {
      throw new Error('Requires isolated test_db');
    }
    process.env.CORS_ALLOWED_ORIGINS = origin;
    process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME = 'feature_access';
    const metrics = {
      observeDatabaseQuery: jest.fn(),
    } as unknown as PrometheusMetricsService;
    prisma = new PrismaService(metrics);
    second = new PrismaService(metrics);
    await Promise.all([prisma.$connect(), second.$connect()]);
    clips = new PrismaClipsRepository(second);
    folders = new PrismaFoldersRepository(second);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    jwt = module.get(JwtService);
    secret = module.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET');
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
    userId = randomUUID();
    workspaceId = randomUUID();
    folderId = randomUUID();
    lockedId = randomUUID();
    clipId = randomUUID();
    tagId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        ownedWorkspace: {
          create: {
            id: workspaceId,
            name: 'Feature test',
            subscription: { create: { plan: 'FREE' } },
            folders: {
              create: [
                { id: folderId, name: 'Accessible', order: 0 },
                { id: lockedId, name: 'Locked', order: 1 },
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
        type: 'TEXT',
        title: 'needle',
        textContent: 'needle content',
        tags: {
          create: {
            tag: {
              create: {
                id: tagId,
                folderId,
                name: 'saved',
                backgroundColor: 'ORANGE',
              },
            },
          },
        },
        likes: { create: { userId } },
        views: { create: { userId } },
      },
    });
    cookie = `feature_access=${jwt.sign(
      {
        sub: userId,
        accountId: randomUUID(),
        platform: 'WEB',
        sid: randomUUID(),
      },
      {
        secret,
        audience: 'api',
        issuer: 'easy-clip',
        expiresIn: '30m',
      },
    )}`;
  });
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });
  afterAll(async () => {
    await app?.close();
    await Promise.all([prisma?.$disconnect(), second?.$disconnect()]);
    if (previousOrigin === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = previousOrigin;
    if (previousCookie === undefined)
      delete process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME;
    else process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME = previousCookie;
  });

  it.each(['folder', 'favorite', 'recent', 'default'])(
    'gates nonempty trimmed search on the %s branch, before cursor lookup',
    async (branch) => {
      const query = {
        type: 'ALL',
        ...(branch === 'folder'
          ? { folderId }
          : branch === 'favorite'
            ? { favorite: 'true' }
            : branch === 'recent'
              ? { recent: 'true' }
              : {}),
      };
      for (const q of ['needle', '  saved  ']) {
        await forbidden(http('get', '/clips').query({ ...query, q }));
        await forbidden(
          http('get', '/clips').query({
            ...query,
            q,
            cursor: 'missing-cursor',
          }),
        );
      }
      for (const q of [undefined, '', '   ']) {
        const response = await http('get', '/clips')
          .query({ ...query, ...(q === undefined ? {} : { q }) })
          .expect(200);
        expect(JSON.stringify(response.body)).toContain(clipId);
        expect(JSON.stringify(response.body)).toContain('saved');
      }
    },
  );

  it('leaves the recent view IDs endpoint independent of unsupported q', async () => {
    const plain = await http('get', '/clips/views/recent').expect(200);
    const withQ = await http('get', '/clips/views/recent')
      .query({ q: 'needle' })
      .expect(200);
    expect(withQ.body).toEqual(plain.body);
    expect(JSON.stringify(plain.body)).toContain(clipId);
  });

  it('rejects every tag endpoint and preserves both tag rows and associations', async () => {
    const before = await snapshot();
    await forbidden(http('get', `/folders/${folderId}/tags`));
    await forbidden(
      http('post', `/folders/${folderId}/tags`).send({ name: 'new' }),
    );
    await forbidden(
      http('patch', `/folders/${folderId}/tags/${tagId}`).send({
        name: 'renamed',
        backgroundColor: 'GRAY',
      }),
    );
    await forbidden(http('delete', `/folders/${folderId}/tags/${tagId}`));
    await forbidden(
      http('post', `/folders/${folderId}/tags`).send({ name: 'saved' }),
    );
    await forbidden(
      http('patch', `/folders/${folderId}/tags/${tagId}`).send({
        name: 'saved',
      }),
    );
    for (const tags of [['new'], ['saved'], []]) {
      await forbidden(http('put', `/clips/${clipId}/tags`).send({ tags }));
    }
    expect(await snapshot()).toEqual(before);
  });

  it.each(['ACTIVE', 'CANCELED'] as const)(
    'permits search and tag management during effective %s Pro and preserves tags through downgrade/reupgrade',
    async (status) => {
      await subscribe(status, new Date(Date.now() + 86_400_000));
      for (const scope of [
        { folderId },
        { favorite: 'true' },
        { recent: 'true' },
        {},
      ]) {
        for (const q of ['needle', '  saved  ']) {
          const response = await http('get', '/clips')
            .query({ type: 'ALL', ...scope, q })
            .expect(200);
          expect(JSON.stringify(response.body)).toContain(clipId);
        }
      }
      await http('put', `/clips/${clipId}/tags`)
        .send({ tags: ['saved', 'new'] })
        .expect(200);
      await http('post', `/folders/${folderId}/tags`)
        .send({ name: 'unused' })
        .expect(201);
      await http('patch', `/folders/${folderId}/tags/${tagId}`)
        .send({ backgroundColor: 'GRAY' })
        .expect(200);
      const before = await snapshot();
      await subscribe('ACTIVE', new Date(Date.now() - 60_000));
      await forbidden(
        http('get', '/clips').query({ type: 'ALL', q: 'needle' }),
      );
      await forbidden(http('put', `/clips/${clipId}/tags`).send({ tags: [] }));
      const normal = await http('get', '/clips')
        .query({ type: 'ALL', folderId })
        .expect(200);
      expect(JSON.stringify(normal.body)).toContain('saved');
      expect(await snapshot()).toEqual(before);
      await subscribe(status, new Date(Date.now() + 86_400_000));
      await http('get', `/folders/${folderId}/tags`).expect(200);
      expect(await snapshot()).toEqual(before);
      await http('delete', `/folders/${folderId}/tags/${tagId}`).expect(200);
    },
  );

  it('preserves ownership and locked-folder errors', async () => {
    const lockedClip = await prisma.clip.create({
      data: { workspaceId, folderId: lockedId, type: 'TEXT', title: 'locked' },
    });
    await forbidden(http('get', `/folders/${lockedId}/tags`), 'PROJECT_LOCKED');
    await forbidden(
      http('put', `/clips/${lockedClip.id}/tags`).send({ tags: [] }),
      'PROJECT_LOCKED',
    );
    const other = await prisma.user.create({
      data: {
        ownedWorkspace: {
          create: { name: 'Other', folders: { create: { name: 'Other' } } },
        },
      },
      include: { ownedWorkspace: { include: { folders: true } } },
    });
    try {
      const foreignFolder = other.ownedWorkspace!.folders[0];
      const foreignClip = await prisma.clip.create({
        data: {
          workspaceId: other.ownedWorkspace!.id,
          folderId: foreignFolder.id,
          type: 'TEXT',
        },
      });
      await http('get', `/folders/${foreignFolder.id}/tags`).expect(404);
      await http('put', `/clips/${foreignClip.id}/tags`)
        .send({ tags: [] })
        .expect(404);
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });

  it('keeps missing/deleted resource 404 and locked-folder priority for every management path', async () => {
    const lockedTag = await prisma.tag.create({
      data: { folderId: lockedId, name: 'locked' },
    });
    for (const id of [lockedId, 'missing-folder']) {
      const calls = [
        () =>
          http('get', '/clips').query({
            folderId: id,
            type: 'ALL',
            q: 'needle',
          }),
        () => http('get', `/folders/${id}/tags`),
        () => http('post', `/folders/${id}/tags`).send({ name: 'new' }),
        () =>
          http('patch', `/folders/${id}/tags/${lockedTag.id}`).send({
            name: 'renamed',
          }),
        () => http('delete', `/folders/${id}/tags/${lockedTag.id}`),
      ];
      for (const makeCall of calls) {
        if (id === lockedId) await forbidden(makeCall(), 'PROJECT_LOCKED');
        else await makeCall().expect(404);
      }
    }
    await http('patch', `/folders/${folderId}/tags/missing-tag`)
      .send({ name: 'new' })
      .expect(404);
    await http('delete', `/folders/${folderId}/tags/missing-tag`).expect(404);
    await http('put', '/clips/missing-clip/tags')
      .send({ tags: [] })
      .expect(404);
    await prisma.clip.update({
      where: { id: clipId },
      data: { deletedAt: new Date() },
    });
    await http('put', `/clips/${clipId}/tags`).send({ tags: [] }).expect(404);
    await prisma.folder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
    });
    await http('get', `/folders/${folderId}/tags`).expect(404);
    await http('get', '/clips')
      .query({ folderId, type: 'ALL', q: 'needle' })
      .expect(404);
  });

  it('rejects a previously issued Pro search cursor after downgrade on every branch', async () => {
    await subscribe('ACTIVE', new Date(Date.now() + 86_400_000));
    for (let index = 0; index < 21; index++) {
      await prisma.clip.create({
        data: {
          workspaceId,
          folderId,
          type: 'TEXT',
          title: 'needle',
          likes: { create: { userId } },
          views: { create: { userId } },
        },
      });
    }
    const pages: { query: Record<string, string>; cursor: string }[] = [];
    for (const scope of [
      { folderId },
      { favorite: 'true' },
      { recent: 'true' },
      {},
    ]) {
      const query = { type: 'ALL', ...scope } as Record<string, string>;
      const first = await http('get', '/clips')
        .query({ ...query, q: 'needle' })
        .expect(200);
      const body = first.body as { nextCursor: string; hasMore: boolean };
      expect(body.hasMore).toBe(true);
      expect(typeof body.nextCursor).toBe('string');
      pages.push({ query, cursor: body.nextCursor });
      await http('get', '/clips')
        .query({ ...query, q: 'needle', cursor: body.nextCursor })
        .expect(200);
    }
    await prisma.subscription.update({
      where: { workspaceId },
      data: { plan: 'FREE' },
    });
    for (const { query, cursor } of pages) {
      await forbidden(
        http('get', '/clips').query({ ...query, q: 'needle', cursor }),
      );
      await http('get', '/clips')
        .query({ ...query, cursor })
        .expect(200);
    }
    await http('get', '/clips')
      .query({ type: 'ALL', searchTarget: 'tag' })
      .expect(400);
  });

  it('rechecks wall-clock expiry after acquiring a waited-on folder lock', async () => {
    const end = new Date(Date.now() + 1000);
    await subscribe('ACTIVE', end);
    const before = await snapshot();
    let release!: () => void;
    let acquired!: (pid: number) => void;
    const ready = new Promise<number>((resolve) => {
      acquired = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Folder" WHERE "id" = ${folderId} FOR UPDATE`;
      const [row] = await tx.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;
      acquired(row.pid);
      await released;
    });
    const pid = await ready;
    const pending = clips
      .replaceClipTags({ userId, clipId, tagNames: [] })
      .then(
        () => ({ succeeded: true }),
        (error: unknown) => error,
      );
    try {
      let blocked = false;
      while (Date.now() < end.getTime()) {
        const [row] = await prisma.$queryRaw<
          { blocked: boolean }[]
        >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))) AS blocked`;
        if (row.blocked) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, end.getTime() - Date.now() + 20)),
      );
    } finally {
      release();
      await holder;
    }
    expect(await pending).toMatchObject(featureError);
    expect(await snapshot()).toEqual(before);
  });

  it.each(['downgrade', 'expiry'] as const)(
    'rechecks %s after tag writes actually wait on a PostgreSQL lock',
    async (change) => {
      await subscribe('ACTIVE', new Date(Date.now() + 86_400_000));
      const before = await snapshot();
      let release!: () => void;
      let locked!: (pid: number) => void;
      const acquired = new Promise<number>((resolve) => {
        locked = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
          const [connection] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          locked(connection.pid);
          await released;
          await tx.subscription.update({
            where: { workspaceId },
            data:
              change === 'downgrade'
                ? { plan: 'FREE' }
                : { currentPeriodEnd: new Date(Date.now() - 60_000) },
          });
        },
        { timeout: 15_000 },
      );
      const pid = await acquired;
      const pending = [
        clips.replaceClipTags({ userId, clipId, tagNames: ['replacement'] }),
        folders.createFolderTag({
          folderId,
          name: 'new',
          backgroundColor: 'GRAY',
        }),
        folders.updateFolderTag(tagId, { name: 'renamed' }),
        folders.deleteFolderTag(tagId),
      ].map((operation) =>
        operation.then(
          () => ({ succeeded: true }),
          (error: unknown) => error,
        ),
      );
      try {
        const deadline = Date.now() + 5_000;
        let blocked = 0;
        while (Date.now() < deadline) {
          const [result] = await prisma.$queryRaw<
            { count: number }[]
          >`WITH RECURSIVE waiting AS (
              SELECT pid FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))
              UNION
              SELECT activity.pid FROM pg_stat_activity activity JOIN waiting ON waiting.pid = ANY(pg_blocking_pids(activity.pid))
            ) SELECT count(*)::int AS count FROM waiting`;
          blocked = result.count;
          if (blocked >= 4) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(blocked).toBeGreaterThanOrEqual(4);
      } finally {
        release();
        await holder;
      }
      for (const result of await Promise.all(pending))
        expect(result).toMatchObject(featureError);
      expect(await snapshot()).toEqual(before);
    },
  );
});
