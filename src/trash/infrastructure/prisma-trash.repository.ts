import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { assertClipIncrease } from 'src/shared/application/clip-limit';
import { lockClipQuota } from 'src/shared/infrastructure/prisma-clip-limit';
import {
  assertFolderAccess,
  lockWorkspaceAccess,
  prepareFolderRestore,
  resolveFolderAccess,
  type FolderAccess,
} from 'src/shared/infrastructure/prisma-folder-access';
import { TrashError } from '../application/errors/trash.error';
import {
  HardDeleteAllTrashItemsResult,
  HardDeleteSelectedTrashItemsResult,
  HardDeleteTrashItemsResult,
  TrashRepository,
} from '../domain/trash.repository';
import {
  DeleteTrashItemsParams,
  FindTrashItemsParams,
  RestoreTrashItemsParams,
  TrashClipItem,
  TrashFolderItem,
  TrashItem,
  TrashItemType,
} from '../domain/trash.types';

@Injectable()
export class PrismaTrashRepository implements TrashRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDeletedItems(params: FindTrashItemsParams): Promise<TrashItem[]> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { ownerUserId: params.userId },
        select: { id: true },
      });
      if (!workspace) return [];
      const access = await lockWorkspaceAccess(tx, workspace.id);
      const cursor = await this.findTrashItemCursor(tx, params, access);
      if (params.cursor && !cursor) return [];
      const [clips, folders] = await Promise.all([
        tx.clip.findMany({
          where: {
            workspaceId: workspace.id,
            deletedAt: { not: null },
            folder: { deletedAt: null },
            ...this.clipAccessWhere(access),
            ...(cursor ? { OR: buildClipTrashCursorWhere(cursor) } : {}),
          },
          orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
          take: params.limit,
          select: {
            id: true,
            title: true,
            type: true,
            folderId: true,
            deletedAt: true,
          },
        }) as Promise<TrashClipItem[]>,
        tx.folder.findMany({
          where: {
            workspaceId: workspace.id,
            deletedAt: { not: null },
            ...(cursor ? { OR: buildFolderTrashCursorWhere(cursor) } : {}),
          },
          orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
          take: params.limit,
          select: { id: true, name: true, deletedAt: true },
        }) as Promise<TrashFolderItem[]>,
      ]);
      return [
        ...clips.map((clip): TrashItem => ({ ...clip, itemType: 'CLIP' })),
        ...folders.map(
          (folder): TrashItem => ({ ...folder, itemType: 'FOLDER' }),
        ),
      ]
        .sort(compareTrashItems)
        .slice(0, params.limit);
    });
  }

  async findDeletedClipsByIds(
    userId: string,
    clipIds: string[],
  ): Promise<TrashClipItem[]> {
    if (clipIds.length === 0) {
      return [];
    }

    const clips = await this.prisma.clip.findMany({
      where: {
        id: {
          in: clipIds,
        },
        deletedAt: {
          not: null,
        },
        workspace: {
          ownerUserId: userId,
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        folderId: true,
        deletedAt: true,
        folder: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    return clips.map(
      (clip): TrashClipItem => ({
        id: clip.id,
        title: clip.title,
        type: clip.type,
        folderId: clip.folderId,
        deletedAt: clip.deletedAt,
        folderDeletedAt: clip.folder.deletedAt,
      }),
    );
  }

  async findDeletedClipById(
    userId: string,
    clipId: string,
  ): Promise<TrashClipItem | null> {
    const clip = await this.prisma.clip.findFirst({
      where: {
        id: clipId,
        deletedAt: {
          not: null,
        },
        workspace: {
          ownerUserId: userId,
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        folderId: true,
        deletedAt: true,
        folder: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!clip) {
      return null;
    }

    return {
      id: clip.id,
      title: clip.title,
      type: clip.type,
      folderId: clip.folderId,
      deletedAt: clip.deletedAt,
      folderDeletedAt: clip.folder.deletedAt,
    } as TrashClipItem;
  }

  async restoreItems(params: RestoreTrashItemsParams): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const workspaceId = await lockClipQuota(tx, params.userId);
      const folderIds = [...new Set(params.folderIds)];
      const clipIds = [...new Set(params.clipIds)];
      const candidates = await tx.clip.findMany({
        where: { id: { in: clipIds }, workspaceId },
        select: { id: true, folderId: true },
      });
      const parentIds = [
        ...new Set([...folderIds, ...candidates.map((clip) => clip.folderId)]),
      ];
      const ownedFolders = await tx.folder.findMany({
        where: { id: { in: parentIds }, workspaceId },
        select: { id: true },
      });
      await this.lockFolders(
        tx,
        ownedFolders.map((folder) => folder.id),
      );
      await this.lockClips(
        tx,
        candidates.map((clip) => clip.id),
      );
      const folders = await tx.folder.findMany({
        where: { id: { in: parentIds }, workspaceId },
        select: { id: true, deletedAt: true },
      });
      const clips = await tx.clip.findMany({
        where: { id: { in: clipIds }, workspaceId, deletedAt: { not: null } },
        select: { id: true, folderId: true },
      });
      if (clips.length !== clipIds.length) {
        throw new TrashError('NOT_FOUND', '휴지통 클립을 찾을 수 없습니다.');
      }
      const restoringFolders = new Set(folderIds);
      if (
        folders.filter(
          (folder) =>
            restoringFolders.has(folder.id) && folder.deletedAt !== null,
        ).length !== folderIds.length
      ) {
        throw new TrashError('NOT_FOUND', '휴지통 폴더를 찾을 수 없습니다.');
      }
      const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
      const increases = new Map<string, number>();
      for (const clip of clips) {
        const folder = foldersById.get(clip.folderId);
        if (!folder)
          throw new TrashError('NOT_FOUND', '클립의 폴더를 찾을 수 없습니다.');
        if (folder.deletedAt && !restoringFolders.has(folder.id)) {
          throw new TrashError(
            'CONFLICT',
            '삭제된 폴더에 속한 클립은 단독으로 복구할 수 없습니다.',
          );
        }
        increases.set(folder.id, (increases.get(folder.id) ?? 0) + 1);
      }
      const access = await prepareFolderRestore(
        tx,
        await resolveFolderAccess(tx, workspaceId),
        folderIds,
      );
      for (const folderId of increases.keys()) {
        assertFolderAccess(access, folderId);
      }
      const projectedCounts: Array<{
        folderId: string;
        currentCount: number;
        increase: number;
      }> = [];
      for (const [folderId, increase] of increases) {
        // 폴더 자체 복구는 기존 클립을 다시 노출할 뿐 추가 복구량이 아니다.
        const currentCount = await tx.clip.count({
          where: { folderId, deletedAt: null },
        });
        projectedCounts.push({ folderId, currentCount, increase });
      }
      // 전체 요청에 300개 초과 폴더가 있으면 업그레이드로 해결된다고 안내하지 않는다.
      projectedCounts.sort(
        (a, b) =>
          b.currentCount + b.increase - a.currentCount - a.increase ||
          a.folderId.localeCompare(b.folderId),
      );
      for (const { folderId, currentCount, increase } of projectedCounts) {
        assertClipIncrease(access, folderId, currentCount, increase);
      }
      if (folderIds.length > 0) {
        await tx.folder.updateMany({
          where: { id: { in: folderIds }, workspaceId },
          data: { deletedAt: null },
        });
      }
      if (clipIds.length > 0) {
        await tx.clip.updateMany({
          where: { id: { in: clipIds }, workspaceId },
          data: { deletedAt: null },
        });
      }
    });
  }

  async hardDeleteItems(
    params: DeleteTrashItemsParams,
  ): Promise<HardDeleteSelectedTrashItemsResult> {
    return this.prisma.$transaction(async (tx) => {
      const workspaceId = await lockClipQuota(tx, params.userId);
      return this.deleteOwnedItems(
        tx,
        workspaceId,
        params.folderIds,
        params.clipIds,
      );
    });
  }

  async findDeletedFoldersByIds(
    userId: string,
    folderIds: string[],
  ): Promise<TrashFolderItem[]> {
    if (folderIds.length === 0) {
      return [];
    }

    return this.prisma.folder.findMany({
      where: {
        id: {
          in: folderIds,
        },
        deletedAt: {
          not: null,
        },
        workspace: {
          ownerUserId: userId,
        },
      },
      select: {
        id: true,
        name: true,
        deletedAt: true,
      },
    }) as Promise<TrashFolderItem[]>;
  }

  async findDeletedFolderById(
    userId: string,
    folderId: string,
  ): Promise<TrashFolderItem | null> {
    return this.prisma.folder.findFirst({
      where: {
        id: folderId,
        deletedAt: {
          not: null,
        },
        workspace: {
          ownerUserId: userId,
        },
      },
      select: {
        id: true,
        name: true,
        deletedAt: true,
      },
    }) as Promise<TrashFolderItem | null>;
  }

  async hardDeleteExpiredFoldersWithClips(
    expiresBefore: Date,
    limit: number,
  ): Promise<HardDeleteTrashItemsResult> {
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.folder.findMany({
        where: { deletedAt: { lte: expiresBefore } },
        orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
        take: limit,
        select: { id: true },
      });
      if (candidates.length === 0) return this.emptyHardDeleteResult();
      await this.lockFolders(
        tx,
        candidates.map((folder) => folder.id),
      );
      const folders = await tx.folder.findMany({
        where: {
          id: { in: candidates.map((folder) => folder.id) },
          deletedAt: { lte: expiresBefore },
        },
        select: { id: true },
      });
      const folderIds = folders.map((folder) => folder.id);
      const children = await tx.clip.findMany({
        where: { folderId: { in: folderIds } },
        select: { id: true },
      });
      await this.lockClips(
        tx,
        children.map((clip) => clip.id),
      );
      const imageClips = await tx.clip.findMany({
        where: { folderId: { in: folderIds }, imageUrl: { not: null } },
        select: { imageUrl: true },
      });
      const result = await tx.folder.deleteMany({
        where: { id: { in: folderIds } },
      });
      return {
        deletedCount: result.count,
        imageUrls: this.compactImageUrls(
          imageClips.map((clip) => clip.imageUrl),
        ),
      };
    });
  }

  async hardDeleteExpiredClips(
    expiresBefore: Date,
    limit: number,
  ): Promise<HardDeleteTrashItemsResult> {
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.clip.findMany({
        where: {
          deletedAt: { lte: expiresBefore },
          folder: { deletedAt: null },
        },
        orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
        take: limit,
        select: { id: true, folderId: true },
      });
      if (candidates.length === 0) return this.emptyHardDeleteResult();
      await this.lockFolders(
        tx,
        candidates.map((clip) => clip.folderId),
      );
      await this.lockClips(
        tx,
        candidates.map((clip) => clip.id),
      );
      const clips = await tx.clip.findMany({
        where: {
          id: { in: candidates.map((clip) => clip.id) },
          deletedAt: { lte: expiresBefore },
          folder: { deletedAt: null },
        },
        select: { id: true, imageUrl: true },
      });
      const result = await tx.clip.deleteMany({
        where: { id: { in: clips.map((clip) => clip.id) } },
      });
      return {
        deletedCount: result.count,
        imageUrls: this.compactImageUrls(clips.map((clip) => clip.imageUrl)),
      };
    });
  }

  async hardDeleteAllTrashItemsForUser(
    userId: string,
  ): Promise<HardDeleteAllTrashItemsResult> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { ownerUserId: userId },
        select: { id: true },
      });
      if (!workspace) {
        return {
          clipsDeleted: 0,
          foldersDeleted: 0,
          totalDeleted: 0,
          imageUrls: [],
        };
      }
      const workspaceId = await lockClipQuota(tx, userId);
      const folders = await tx.folder.findMany({
        where: { workspaceId, deletedAt: { not: null } },
        select: { id: true },
      });
      const clips = await tx.clip.findMany({
        where: {
          workspaceId,
          deletedAt: { not: null },
          folder: { deletedAt: null },
        },
        select: { id: true },
      });
      return this.deleteOwnedItems(
        tx,
        workspaceId,
        folders.map((folder) => folder.id),
        clips.map((clip) => clip.id),
        true,
      );
    });
  }

  private async deleteOwnedItems(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    requestedFolderIds: string[],
    requestedClipIds: string[],
    requireActiveParent = false,
  ): Promise<HardDeleteSelectedTrashItemsResult> {
    const explicitClips = await tx.clip.findMany({
      where: { id: { in: requestedClipIds }, workspaceId },
      select: { id: true, folderId: true },
    });
    const parentIds = [
      ...new Set([
        ...requestedFolderIds,
        ...explicitClips.map((clip) => clip.folderId),
      ]),
    ];
    const ownedFolders = await tx.folder.findMany({
      where: { id: { in: parentIds }, workspaceId },
      select: { id: true },
    });
    await this.lockFolders(
      tx,
      ownedFolders.map((folder) => folder.id),
    );
    // 복구가 먼저 완료됐다면 자식 조회·삭제와 이미지 정리 대상 모두에서 제외한다.
    const folders = await tx.folder.findMany({
      where: {
        id: { in: requestedFolderIds },
        workspaceId,
        deletedAt: { not: null },
      },
      select: { id: true },
    });
    const folderIds = folders.map((folder) => folder.id);
    const clipWhere: Prisma.ClipWhereInput = {
      workspaceId,
      OR: [
        { folderId: { in: folderIds } },
        {
          id: { in: requestedClipIds },
          deletedAt: { not: null },
          ...(requireActiveParent ? { folder: { deletedAt: null } } : {}),
        },
      ],
    };
    const candidates = await tx.clip.findMany({
      where: clipWhere,
      select: { id: true },
    });
    await this.lockClips(
      tx,
      candidates.map((clip) => clip.id),
    );
    const clips = await tx.clip.findMany({
      where: { ...clipWhere, id: { in: candidates.map((clip) => clip.id) } },
      select: { id: true, imageUrl: true },
    });
    const clipDeletion = await tx.clip.deleteMany({
      where: { id: { in: clips.map((clip) => clip.id) } },
    });
    const folderDeletion = await tx.folder.deleteMany({
      where: { id: { in: folderIds } },
    });
    return {
      clipsDeleted: clipDeletion.count,
      foldersDeleted: folderDeletion.count,
      totalDeleted: clipDeletion.count + folderDeletion.count,
      imageUrls: this.compactImageUrls(clips.map((clip) => clip.imageUrl)),
    };
  }

  private async lockFolders(
    tx: Prisma.TransactionClient,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    await tx.$queryRaw`SELECT "id" FROM "Folder" WHERE "id" IN (${Prisma.join([...new Set(ids)])}) ORDER BY "id" FOR UPDATE`;
  }

  private async lockClips(
    tx: Prisma.TransactionClient,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    await tx.$queryRaw`SELECT "id" FROM "Clip" WHERE "id" IN (${Prisma.join([...new Set(ids)])}) ORDER BY "id" FOR UPDATE`;
  }

  private compactImageUrls(imageUrls: Array<string | null | undefined>) {
    return imageUrls.filter((imageUrl): imageUrl is string =>
      Boolean(imageUrl),
    );
  }

  private emptyHardDeleteResult(): HardDeleteTrashItemsResult {
    return {
      deletedCount: 0,
      imageUrls: [],
    };
  }

  private clipAccessWhere(access: FolderAccess): Prisma.ClipWhereInput {
    return access.effectivePlan === 'FREE'
      ? {
          folderId: {
            in: access.accessibleFolderId ? [access.accessibleFolderId] : [],
          },
        }
      : {};
  }

  private async findTrashItemCursor(
    tx: Prisma.TransactionClient,
    params: FindTrashItemsParams,
    access: FolderAccess,
  ): Promise<TrashItemCursor | null> {
    if (!params.cursor) return null;
    const parsedCursor = parseTrashItemCursor(params.cursor);
    if (!parsedCursor) return null;
    if (parsedCursor.itemType === 'CLIP') {
      const clip = await tx.clip.findFirst({
        where: {
          id: parsedCursor.id,
          workspaceId: access.workspaceId,
          deletedAt: { not: null },
          folder: { deletedAt: null },
          ...this.clipAccessWhere(access),
        },
        select: { id: true, deletedAt: true },
      });
      return clip ? { ...clip, itemType: 'CLIP' } : null;
    }
    const folder = await tx.folder.findFirst({
      where: {
        id: parsedCursor.id,
        workspaceId: access.workspaceId,
        deletedAt: { not: null },
      },
      select: { id: true, deletedAt: true },
    });
    return folder ? { ...folder, itemType: 'FOLDER' } : null;
  }
}

type TrashCursor = {
  id: string;
  deletedAt: Date | null;
};

type TrashItemCursor = TrashCursor & {
  itemType: TrashItemType;
};

const TRASH_ITEM_TYPE_ORDER: Record<TrashItemType, number> = {
  CLIP: 0,
  FOLDER: 1,
};

function parseTrashItemCursor(
  cursor: string,
): { itemType: TrashItemType; id: string } | null {
  const [itemType, id] = cursor.split(':');

  if ((itemType !== 'CLIP' && itemType !== 'FOLDER') || !id) {
    return null;
  }

  return { itemType, id };
}

function compareTrashItems(a: TrashItem, b: TrashItem): number {
  const deletedAtDiff =
    (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0);

  if (deletedAtDiff !== 0) {
    return deletedAtDiff;
  }

  const itemTypeDiff =
    TRASH_ITEM_TYPE_ORDER[a.itemType] - TRASH_ITEM_TYPE_ORDER[b.itemType];

  if (itemTypeDiff !== 0) {
    return itemTypeDiff;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? 1 : -1;
}

function buildClipTrashCursorWhere(
  cursor: TrashItemCursor,
): Prisma.ClipWhereInput[] {
  if (!cursor.deletedAt) {
    return [];
  }

  const sameDeletedAtWhere: Prisma.ClipWhereInput[] = [];

  if (TRASH_ITEM_TYPE_ORDER.CLIP > TRASH_ITEM_TYPE_ORDER[cursor.itemType]) {
    sameDeletedAtWhere.push({
      deletedAt: cursor.deletedAt,
    });
  }

  if (cursor.itemType === 'CLIP') {
    sameDeletedAtWhere.push({
      deletedAt: cursor.deletedAt,
      id: {
        lt: cursor.id,
      },
    });
  }

  return [
    {
      deletedAt: {
        lt: cursor.deletedAt,
      },
    },
    ...sameDeletedAtWhere,
  ];
}

function buildFolderTrashCursorWhere(
  cursor: TrashItemCursor,
): Prisma.FolderWhereInput[] {
  if (!cursor.deletedAt) {
    return [];
  }

  const sameDeletedAtWhere: Prisma.FolderWhereInput[] = [];

  if (TRASH_ITEM_TYPE_ORDER.FOLDER > TRASH_ITEM_TYPE_ORDER[cursor.itemType]) {
    sameDeletedAtWhere.push({
      deletedAt: cursor.deletedAt,
    });
  }

  if (cursor.itemType === 'FOLDER') {
    sameDeletedAtWhere.push({
      deletedAt: cursor.deletedAt,
      id: {
        lt: cursor.id,
      },
    });
  }

  return [
    {
      deletedAt: {
        lt: cursor.deletedAt,
      },
    },
    ...sameDeletedAtWhere,
  ];
}
