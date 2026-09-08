import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaClipsRepository } from '../src/clips/infrastructure/prisma-clips.repository';
import { PrismaFoldersRepository } from '../src/folders/infrastructure/prisma-folders.repository';
import { PrismaTrashRepository } from '../src/trash/infrastructure/prisma-trash.repository';
import { UpdateClipUseCase } from '../src/clips/application/usecases/update-clip.usecase';
import { PrometheusMetricsService } from '../src/shared/infrastructure/prometheus/prometheus-metrics.service';

const content = {
  type: 'TEXT' as const,
  title: 'new content',
  textContent: 'new content',
  colorHex: null,
  imageUrl: null,
};
const lockedError = { code: 'FORBIDDEN', policyCode: 'PROJECT_LOCKED' };

describe('Folder access (PostgreSQL integration)', () => {
  let prisma: PrismaService;
  let second: PrismaService;
  let clips: PrismaClipsRepository;
  let secondClips: PrismaClipsRepository;
  let folders: PrismaFoldersRepository;
  let secondFolders: PrismaFoldersRepository;
  let trash: PrismaTrashRepository;
  let userId: string;
  let workspaceId: string;
  let selectedId: string;
  let lockedId: string;
  let visibleClipId: string;
  let lockedClipId: string;
  let lockedTagId: string;
  let lockedViewId: string;

  const create = (folderId: string) =>
    clips.createClip(userId, {
      ...content,
      workspaceId,
      folderId,
    });
  const subscribe = (
    status: 'ACTIVE' | 'CANCELED',
    currentPeriodEnd: Date,
    autoRenew = false,
  ) =>
    prisma.subscription.update({
      where: { workspaceId },
      data: { plan: 'PRO', status, currentPeriodEnd, autoRenew },
    });
  const clipRow = (id: string) =>
    prisma.clip.findUniqueOrThrow({ where: { id } });
  const seedDeleted = (folderId: string, title: string) =>
    prisma.clip.create({
      data: {
        ...content,
        workspaceId,
        folderId,
        title,
        textContent: title,
        deletedAt: new Date('2026-01-01T00:00:00Z'),
      },
    });

  beforeAll(async () => {
    if (
      !process.env.DATABASE_URL ||
      new URL(process.env.DATABASE_URL).pathname !== '/test_db'
    ) {
      throw new Error(
        'Folder access integration tests require isolated test_db',
      );
    }
    const metrics = {
      observeDatabaseQuery: jest.fn(),
    } as unknown as PrometheusMetricsService;
    prisma = new PrismaService(metrics);
    second = new PrismaService(metrics);
    await Promise.all([prisma.$connect(), second.$connect()]);
    clips = new PrismaClipsRepository(prisma);
    secondClips = new PrismaClipsRepository(second);
    folders = new PrismaFoldersRepository(prisma);
    secondFolders = new PrismaFoldersRepository(second);
    trash = new PrismaTrashRepository(second);
  });

  beforeEach(async () => {
    const suffix = randomUUID();
    userId = randomUUID();
    workspaceId = randomUUID();
    selectedId = `a-${suffix}`;
    lockedId = `z-${suffix}`;
    visibleClipId = randomUUID();
    lockedClipId = randomUUID();
    lockedTagId = randomUUID();
    lockedViewId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        ownedWorkspace: {
          create: {
            id: workspaceId,
            name: 'Folder access test',
            subscription: { create: { plan: 'FREE' } },
            folders: {
              create: [
                { id: selectedId, name: 'First', order: 0 },
                { id: lockedId, name: 'Second', order: 0 },
              ],
            },
          },
        },
      },
    });
    await prisma.clip.createMany({
      data: [
        {
          ...content,
          id: visibleClipId,
          workspaceId,
          folderId: selectedId,
          title: 'visible-note',
          textContent: 'visible-note',
        },
        {
          ...content,
          id: lockedClipId,
          workspaceId,
          folderId: lockedId,
          title: 'locked-secret',
          textContent: 'locked-secret',
        },
      ],
    });
    await prisma.tag.create({
      data: {
        id: lockedTagId,
        folderId: lockedId,
        name: 'locked-tag',
        clips: { create: { clipId: lockedClipId } },
      },
    });
    await prisma.clipLike.createMany({
      data: [
        { userId, clipId: visibleClipId },
        { userId, clipId: lockedClipId },
      ],
    });
    await prisma.clipView.createMany({
      data: [
        { userId, clipId: visibleClipId },
        { id: lockedViewId, userId, clipId: lockedClipId },
      ],
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  afterAll(async () => {
    await Promise.all([prisma?.$disconnect(), second?.$disconnect()]);
  });

  it.each([false, true])(
    'chooses by order then ID with lower second order=%s and agrees across connections',
    async (lowerSecondOrder) => {
      if (lowerSecondOrder) {
        await prisma.folder.update({
          where: { id: lockedId },
          data: { order: -1 },
        });
      }
      const expectedId = lowerSecondOrder ? lockedId : selectedId;
      const results = await Promise.all([
        folders.findFoldersByWorkspaceId(workspaceId),
        secondFolders.findFoldersByWorkspaceId(workspaceId),
      ]);
      for (const result of results) {
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ id: expectedId, isLocked: false });
        expect(result[1]).toMatchObject({ isLocked: true });
      }
      expect(
        await prisma.workspace.findUniqueOrThrow({
          where: { id: workspaceId },
        }),
      ).toMatchObject({ freeAccessibleFolderId: expectedId });
    },
  );

  it('permits selected-folder reads and content writes while retaining locked data', async () => {
    expect(
      await clips.findClipByIdForUser(userId, visibleClipId),
    ).toMatchObject({ id: visibleClipId });
    expect(
      await clips.updateClip(userId, visibleClipId, content),
    ).toMatchObject({ clip: { title: content.title } });
    expect(await create(selectedId)).toMatchObject({ folderId: selectedId });
    await clips.createClipView(userId, visibleClipId);
    await clips.createClipLike(userId, visibleClipId);
    expect(await clipRow(lockedClipId)).toMatchObject({
      title: 'locked-secret',
      deletedAt: null,
    });
  });

  it('rejects locked direct reads, writes, interactions, tags and mixed bulk deletion without side effects', async () => {
    const oldView = await prisma.clipView.findUniqueOrThrow({
      where: { id: lockedViewId },
    });
    const actions = [
      () => clips.findClipByIdForUser(userId, lockedClipId),
      () => clips.findClips({ userId, folderId: lockedId, limit: 10 }),
      () => clips.updateClip(userId, lockedClipId, content),
      () => clips.updateClip(userId, lockedClipId, { title: 'blocked rename' }),
      () => create(lockedId),
      () => clips.createClipLike(userId, lockedClipId),
      () => clips.deleteClipLike(userId, lockedClipId),
      () => clips.createClipView(userId, lockedClipId),
      () =>
        clips.replaceClipTags({
          userId,
          clipId: lockedClipId,
          tagNames: ['replacement'],
        }),
      () =>
        folders.createFolderTag({
          folderId: lockedId,
          name: 'new-tag',
          backgroundColor: 'GRAY',
        }),
      () => folders.updateFolderTag(lockedTagId, { name: 'changed-tag' }),
      () => folders.deleteFolderTag(lockedTagId),
      () => clips.softDeleteClips(userId, [visibleClipId, lockedClipId]),
      () => clips.softDeleteAllClipsInFolder(userId, lockedId),
    ];
    for (const action of actions) {
      await expect(action()).rejects.toMatchObject(lockedError);
    }
    expect(await clipRow(visibleClipId)).toMatchObject({ deletedAt: null });
    expect(await clipRow(lockedClipId)).toMatchObject({
      title: 'locked-secret',
      deletedAt: null,
    });
    expect(await prisma.clip.count({ where: { workspaceId } })).toBe(2);
    expect(await prisma.clipLike.count({ where: { userId } })).toBe(2);
    expect(
      await prisma.clipView.findUniqueOrThrow({ where: { id: lockedViewId } }),
    ).toEqual(oldView);
    expect(
      await prisma.tag.findMany({ where: { folderId: lockedId } }),
    ).toEqual([
      expect.objectContaining({ id: lockedTagId, name: 'locked-tag' }),
    ]);
    expect(
      await prisma.clipTag.count({
        where: { clipId: lockedClipId, tagId: lockedTagId },
      }),
    ).toBe(1);
  });

  it('hides locked clips from global, title, tag fallback, recent, liked and bulk-ID reads', async () => {
    const global = await clips.findClips({ userId, limit: 10 });
    expect(global.map(({ id }) => id)).toEqual([visibleClipId]);
    expect(
      await clips.findClips({
        userId,
        limit: 10,
        q: 'locked-secret',
        searchTarget: 'title',
      }),
    ).toEqual([]);
    expect(
      await clips.findClips({
        userId,
        limit: 10,
        q: 'locked-tag',
        searchTarget: 'tag',
      }),
    ).toEqual([]);
    expect(
      await clips.findClips({ userId, limit: 10, q: 'locked-tag' }),
    ).toEqual([]);
    expect(
      (await clips.findClips({ userId, limit: 10, likedOnly: true })).map(
        ({ id }) => id,
      ),
    ).toEqual([visibleClipId]);
    expect(
      (await clips.findRecentClips({ userId, limit: 10 })).map(({ id }) => id),
    ).toEqual([visibleClipId]);
    expect(
      await clips.findRecentClips({ userId, limit: 10, q: 'locked-tag' }),
    ).toEqual([]);
    expect(await clips.findRecentViewedClipIds(userId, 10)).toEqual([
      visibleClipId,
    ]);
    expect(
      (
        await clips.findClipsByIdsForUser(userId, [visibleClipId, lockedClipId])
      ).map(({ id }) => id),
    ).toEqual([visibleClipId]);
    expect(await clips.hasTitleMatches({ userId, q: 'locked-secret' })).toBe(
      false,
    );
    expect(
      await clips.hasRecentTitleMatches({ userId, q: 'locked-secret' }),
    ).toBe(false);
    expect(
      await clips.isClipMatchingQuery({
        userId,
        clipId: lockedClipId,
        searchTarget: 'title',
      }),
    ).toBe(false);
    expect(
      await clips.isRecentCursorMatchingQuery({
        userId,
        viewId: lockedViewId,
        searchTarget: 'title',
      }),
    ).toBe(false);
    await expect(
      clips.findClips({ userId, limit: 10, cursor: lockedClipId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      clips.findRecentClips({ userId, limit: 10, cursor: lockedViewId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('hides locked trash clips and blocks restoration while allowing permanent management deletion', async () => {
    const visible = await seedDeleted(selectedId, 'visible deleted');
    const locked = await seedDeleted(lockedId, 'private deleted');
    await prisma.clip.update({
      where: { id: locked.id },
      data: { deletedAt: new Date('2026-02-01T00:00:00Z') },
    });
    expect(
      (await trash.findDeletedItems({ userId, limit: 1 })).map(({ id }) => id),
    ).toEqual([visible.id]);
    expect(
      (await trash.findDeletedItems({ userId, limit: 10 })).map(({ id }) => id),
    ).toEqual([visible.id]);
    expect(
      await trash.findDeletedItems({
        userId,
        limit: 10,
        cursor: `CLIP:${locked.id}`,
      }),
    ).toEqual([]);
    await expect(
      trash.restoreItems({
        userId,
        folderIds: [],
        clipIds: [visible.id, locked.id],
      }),
    ).rejects.toMatchObject(lockedError);
    expect((await clipRow(visible.id)).deletedAt).not.toBeNull();
    expect((await clipRow(locked.id)).deletedAt).not.toBeNull();
    await trash.restoreItems({ userId, folderIds: [], clipIds: [visible.id] });
    expect(
      await trash.hardDeleteItems({
        userId,
        folderIds: [],
        clipIds: [locked.id],
      }),
    ).toMatchObject({ clipsDeleted: 1, totalDeleted: 1 });
    expect(
      await prisma.clip.findUnique({ where: { id: locked.id } }),
    ).toBeNull();
    expect((await clipRow(visible.id)).deletedAt).toBeNull();
  });

  it('treats expired auto-renewing Pro as Free but opens both folders for valid canceled Pro', async () => {
    await subscribe('ACTIVE', new Date(Date.now() - 60_000), true);
    await expect(
      secondClips.findClipByIdForUser(userId, lockedClipId),
    ).rejects.toMatchObject(lockedError);
    expect(await folders.findFoldersByWorkspaceId(workspaceId)).toEqual([
      expect.objectContaining({ id: selectedId, isLocked: false }),
      expect.objectContaining({ id: lockedId, isLocked: true }),
    ]);
    await subscribe('CANCELED', new Date(Date.now() + 86_400_000));
    expect(await folders.findFoldersByWorkspaceId(workspaceId)).toEqual([
      expect.objectContaining({ id: selectedId, isLocked: false }),
      expect.objectContaining({ id: lockedId, isLocked: false }),
    ]);
    expect(
      await secondClips.findClipByIdForUser(userId, lockedClipId),
    ).toMatchObject({ id: lockedClipId });
    expect(
      await secondClips.updateClip(userId, lockedClipId, content),
    ).toMatchObject({ clip: { title: content.title } });
    expect(
      (await clips.findClips({ userId, limit: 10 })).map(({ id }) => id).sort(),
    ).toEqual([visibleClipId, lockedClipId].sort());
  });

  it('rechecks expired Pro at the final write after an allowed pre-read', async () => {
    await subscribe('ACTIVE', new Date(Date.now() + 86_400_000), true);
    jest
      .spyOn(clips, 'findClipByIdForUser')
      .mockImplementationOnce(async (owner, id) => {
        const result = await secondClips.findClipByIdForUser(owner, id);
        expect(result).toMatchObject({ id: lockedClipId });
        await second.subscription.update({
          where: { workspaceId },
          data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
        });
        return result;
      });
    const storage = { uploadImage: jest.fn(), deleteImage: jest.fn() };
    await expect(
      new UpdateClipUseCase(clips, storage).execute(userId, {
        clipId: lockedClipId,
        text: 'forbidden edit',
      }),
    ).rejects.toMatchObject(lockedError);
    expect(await clipRow(lockedClipId)).toMatchObject({
      title: 'locked-secret',
      textContent: 'locked-secret',
    });
    expect(storage.uploadImage).not.toHaveBeenCalled();
    expect(storage.deleteImage).not.toHaveBeenCalled();
  });

  it('keeps other existing folders locked after deleting the chosen folder and permits restoring the choice', async () => {
    expect(
      await clips.findClipByIdForUser(userId, visibleClipId),
    ).toMatchObject({ id: visibleClipId });
    await folders.softDeleteFolder(selectedId);
    await expect(
      secondClips.findClipByIdForUser(userId, lockedClipId),
    ).rejects.toMatchObject(lockedError);
    expect(await folders.findFoldersByWorkspaceId(workspaceId)).toEqual([
      expect.objectContaining({ id: lockedId, isLocked: true }),
    ]);
    await trash.restoreItems({ userId, folderIds: [selectedId], clipIds: [] });
    expect(
      await clips.findClipByIdForUser(userId, visibleClipId),
    ).toMatchObject({ id: visibleClipId });
    await expect(
      secondClips.findClipByIdForUser(userId, lockedClipId),
    ).rejects.toMatchObject(lockedError);
    expect(
      (await prisma.folder.findUniqueOrThrow({ where: { id: selectedId } }))
        .deletedAt,
    ).toBeNull();
  });

  it('reselects by order after a changed paid period even without an intervening Pro request', async () => {
    await subscribe('ACTIVE', new Date(Date.now() - 86_400_000), true);
    expect(await folders.findFoldersByWorkspaceId(workspaceId)).toEqual([
      expect.objectContaining({ id: selectedId, isLocked: false }),
      expect.objectContaining({ id: lockedId, isLocked: true }),
    ]);
    await prisma.folder.update({
      where: { id: lockedId },
      data: { order: -1 },
    });
    // Payment history changes while the client is away; no request observes Pro.
    await subscribe('ACTIVE', new Date(Date.now() - 60_000), true);
    expect(await secondFolders.findFoldersByWorkspaceId(workspaceId)).toEqual([
      expect.objectContaining({ id: lockedId, isLocked: false }),
      expect.objectContaining({ id: selectedId, isLocked: true }),
    ]);
    expect(
      await secondClips.findClipByIdForUser(userId, lockedClipId),
    ).toMatchObject({ id: lockedClipId });
    await expect(
      clips.findClipByIdForUser(userId, visibleClipId),
    ).rejects.toMatchObject(lockedError);
  });

  it('rejects a second Free folder without changing existing folders', async () => {
    await expect(
      folders.createFolder({ workspaceId, name: 'Third', order: 1 }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      policyCode: 'PLAN_LIMIT_EXCEEDED',
    });
    expect(await prisma.folder.count({ where: { workspaceId } })).toBe(2);
  });
});
