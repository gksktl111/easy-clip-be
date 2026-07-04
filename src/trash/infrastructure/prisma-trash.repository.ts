import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
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
    const cursor = await this.findTrashItemCursor(params);

    if (params.cursor && !cursor) {
      return [];
    }

    const [clips, folders] = await Promise.all([
      this.prisma.clip.findMany({
        where: {
          deletedAt: {
            not: null,
          },
          folder: {
            deletedAt: null,
          },
          ...(cursor ? { OR: buildClipTrashCursorWhere(cursor) } : {}),
          workspace: {
            ownerUserId: params.userId,
          },
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
      this.prisma.folder.findMany({
        where: {
          deletedAt: {
            not: null,
          },
          ...(cursor ? { OR: buildFolderTrashCursorWhere(cursor) } : {}),
          workspace: {
            ownerUserId: params.userId,
          },
        },
        orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
        take: params.limit,
        select: {
          id: true,
          name: true,
          deletedAt: true,
        },
      }) as Promise<TrashFolderItem[]>,
    ]);

    return [
      ...clips.map((clip): TrashItem => ({ ...clip, itemType: 'CLIP' })),
      ...folders.map(
        (folder): TrashItem => ({
          ...folder,
          itemType: 'FOLDER',
        }),
      ),
    ]
      .sort(compareTrashItems)
      .slice(0, params.limit);
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
      if (params.folderIds.length > 0) {
        await tx.folder.updateMany({
          where: {
            id: {
              in: params.folderIds,
            },
            deletedAt: {
              not: null,
            },
            workspace: {
              ownerUserId: params.userId,
            },
          },
          data: {
            deletedAt: null,
          },
        });
      }

      if (params.clipIds.length > 0) {
        await tx.clip.updateMany({
          where: {
            id: {
              in: params.clipIds,
            },
            deletedAt: {
              not: null,
            },
            workspace: {
              ownerUserId: params.userId,
            },
            folder: {
              deletedAt: null,
            },
          },
          data: {
            deletedAt: null,
          },
        });
      }
    });
  }

  async hardDeleteItems(
    params: DeleteTrashItemsParams,
  ): Promise<HardDeleteSelectedTrashItemsResult> {
    return this.prisma.$transaction(async (tx) => {
      const folderImageClips =
        params.folderIds.length > 0
          ? await tx.clip.findMany({
              where: {
                folderId: {
                  in: params.folderIds,
                },
                imageUrl: {
                  not: null,
                },
                workspace: {
                  ownerUserId: params.userId,
                },
              },
              select: {
                imageUrl: true,
              },
            })
          : [];

      const folderClipDeletion =
        params.folderIds.length > 0
          ? await tx.clip.deleteMany({
              where: {
                folderId: {
                  in: params.folderIds,
                },
                workspace: {
                  ownerUserId: params.userId,
                },
              },
            })
          : { count: 0 };

      const folderDeletion =
        params.folderIds.length > 0
          ? await tx.folder.deleteMany({
              where: {
                id: {
                  in: params.folderIds,
                },
                deletedAt: {
                  not: null,
                },
                workspace: {
                  ownerUserId: params.userId,
                },
              },
            })
          : { count: 0 };

      const clips =
        params.clipIds.length > 0
          ? await tx.clip.findMany({
              where: {
                id: {
                  in: params.clipIds,
                },
                deletedAt: {
                  not: null,
                },
                workspace: {
                  ownerUserId: params.userId,
                },
              },
              select: {
                id: true,
                imageUrl: true,
              },
            })
          : [];

      const clipDeletion =
        clips.length > 0
          ? await tx.clip.deleteMany({
              where: {
                id: {
                  in: clips.map((clip) => clip.id),
                },
                deletedAt: {
                  not: null,
                },
                workspace: {
                  ownerUserId: params.userId,
                },
              },
            })
          : { count: 0 };

      const clipsDeleted = folderClipDeletion.count + clipDeletion.count;
      const foldersDeleted = folderDeletion.count;

      return {
        clipsDeleted,
        foldersDeleted,
        totalDeleted: clipsDeleted + foldersDeleted,
        imageUrls: this.compactImageUrls([
          ...folderImageClips.map((clip) => clip.imageUrl),
          ...clips.map((clip) => clip.imageUrl),
        ]),
      };
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
    const folders = await this.prisma.folder.findMany({
      where: {
        deletedAt: {
          lte: expiresBefore,
        },
      },
      orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
      },
    });

    if (folders.length === 0) {
      return this.emptyHardDeleteResult();
    }

    const folderIds = folders.map((folder) => folder.id);
    const imageClips = await this.prisma.clip.findMany({
      where: {
        folderId: {
          in: folderIds,
        },
        imageUrl: {
          not: null,
        },
      },
      select: {
        imageUrl: true,
      },
    });

    const result = await this.prisma.folder.deleteMany({
      where: {
        id: {
          in: folderIds,
        },
        deletedAt: {
          lte: expiresBefore,
        },
      },
    });

    return {
      deletedCount: result.count,
      imageUrls: this.compactImageUrls(imageClips.map((clip) => clip.imageUrl)),
    };
  }

  async hardDeleteExpiredClips(
    expiresBefore: Date,
    limit: number,
  ): Promise<HardDeleteTrashItemsResult> {
    const clips = await this.prisma.clip.findMany({
      where: {
        deletedAt: {
          lte: expiresBefore,
        },
        folder: {
          deletedAt: null,
        },
      },
      orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (clips.length === 0) {
      return this.emptyHardDeleteResult();
    }

    const result = await this.prisma.clip.deleteMany({
      where: {
        id: {
          in: clips.map((clip) => clip.id),
        },
        deletedAt: {
          lte: expiresBefore,
        },
        folder: {
          deletedAt: null,
        },
      },
    });

    return {
      deletedCount: result.count,
      imageUrls: this.compactImageUrls(clips.map((clip) => clip.imageUrl)),
    };
  }

  async hardDeleteAllTrashItemsForUser(
    userId: string,
  ): Promise<HardDeleteAllTrashItemsResult> {
    return this.prisma.$transaction(async (tx) => {
      const folders = await tx.folder.findMany({
        where: {
          deletedAt: {
            not: null,
          },
          workspace: {
            ownerUserId: userId,
          },
        },
        select: {
          id: true,
        },
      });

      const folderIds = folders.map((folder) => folder.id);
      const folderImageClips =
        folderIds.length > 0
          ? await tx.clip.findMany({
              where: {
                folderId: {
                  in: folderIds,
                },
                imageUrl: {
                  not: null,
                },
              },
              select: {
                imageUrl: true,
              },
            })
          : [];

      const folderClipDeletion =
        folderIds.length > 0
          ? await tx.clip.deleteMany({
              where: {
                folderId: {
                  in: folderIds,
                },
              },
            })
          : { count: 0 };

      const folderDeletion =
        folderIds.length > 0
          ? await tx.folder.deleteMany({
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
            })
          : { count: 0 };

      const clips = await tx.clip.findMany({
        where: {
          deletedAt: {
            not: null,
          },
          workspace: {
            ownerUserId: userId,
          },
          folder: {
            deletedAt: null,
          },
        },
        select: {
          id: true,
          imageUrl: true,
        },
      });

      const clipDeletion =
        clips.length > 0
          ? await tx.clip.deleteMany({
              where: {
                id: {
                  in: clips.map((clip) => clip.id),
                },
                deletedAt: {
                  not: null,
                },
                workspace: {
                  ownerUserId: userId,
                },
                folder: {
                  deletedAt: null,
                },
              },
            })
          : { count: 0 };

      const clipsDeleted = folderClipDeletion.count + clipDeletion.count;
      const foldersDeleted = folderDeletion.count;

      return {
        clipsDeleted,
        foldersDeleted,
        totalDeleted: clipsDeleted + foldersDeleted,
        imageUrls: this.compactImageUrls([
          ...folderImageClips.map((clip) => clip.imageUrl),
          ...clips.map((clip) => clip.imageUrl),
        ]),
      };
    });
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

  private async findTrashItemCursor(
    params: FindTrashItemsParams,
  ): Promise<TrashItemCursor | null> {
    if (!params.cursor) {
      return null;
    }

    const parsedCursor = parseTrashItemCursor(params.cursor);

    if (!parsedCursor) {
      return null;
    }

    if (parsedCursor.itemType === 'CLIP') {
      const clip = await this.prisma.clip.findFirst({
        where: {
          id: parsedCursor.id,
          deletedAt: {
            not: null,
          },
          folder: {
            deletedAt: null,
          },
          workspace: {
            ownerUserId: params.userId,
          },
        },
        select: {
          id: true,
          deletedAt: true,
        },
      });

      return clip ? { ...clip, itemType: 'CLIP' } : null;
    }

    const folder = await this.prisma.folder.findFirst({
      where: {
        id: parsedCursor.id,
        deletedAt: {
          not: null,
        },
        workspace: {
          ownerUserId: params.userId,
        },
      },
      select: {
        id: true,
        deletedAt: true,
      },
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
