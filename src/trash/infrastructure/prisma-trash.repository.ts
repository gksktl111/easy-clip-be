import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TrashRepository } from '../domain/trash.repository';
import {
  FindTrashItemsParams,
  TrashClipItem,
  TrashFolderItem,
} from '../domain/trash.types';

@Injectable()
export class PrismaTrashRepository implements TrashRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDeletedClips(
    params: FindTrashItemsParams,
  ): Promise<TrashClipItem[]> {
    const cursor = await this.findClipCursor(params);

    if (params.cursor && !cursor) {
      return [];
    }

    return this.prisma.clip.findMany({
      where: {
        deletedAt: {
          not: null,
        },
        ...(cursor ? { OR: buildClipDeletedAtCursorWhere(cursor) } : {}),
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
    }) as Promise<TrashClipItem[]>;
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

  async restoreClip(clipId: string): Promise<TrashClipItem> {
    return this.prisma.clip.update({
      where: { id: clipId },
      data: {
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        type: true,
        folderId: true,
        deletedAt: true,
      },
    }) as Promise<TrashClipItem>;
  }

  async hardDeleteClip(clipId: string): Promise<void> {
    await this.prisma.clip.delete({
      where: { id: clipId },
    });
  }

  async findDeletedFolders(
    params: FindTrashItemsParams,
  ): Promise<TrashFolderItem[]> {
    const cursor = await this.findFolderCursor(params);

    if (params.cursor && !cursor) {
      return [];
    }

    return this.prisma.folder.findMany({
      where: {
        deletedAt: {
          not: null,
        },
        ...(cursor ? { OR: buildFolderDeletedAtCursorWhere(cursor) } : {}),
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

  async restoreFolderWithClips(folderId: string): Promise<TrashFolderItem> {
    return this.prisma.$transaction(async (tx) => {
      await tx.clip.updateMany({
        where: {
          folderId,
          deletedAt: {
            not: null,
          },
        },
        data: {
          deletedAt: null,
        },
      });

      const folder = await tx.folder.update({
        where: { id: folderId },
        data: {
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          deletedAt: true,
        },
      });

      return folder as TrashFolderItem;
    });
  }

  async hardDeleteFolderWithClips(folderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.clip.deleteMany({
        where: {
          folderId,
        },
      });

      await tx.folder.delete({
        where: { id: folderId },
      });
    });
  }

  async hardDeleteExpiredFoldersWithClips(
    expiresBefore: Date,
    limit: number,
  ): Promise<number> {
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
      return 0;
    }

    const result = await this.prisma.folder.deleteMany({
      where: {
        id: {
          in: folders.map((folder) => folder.id),
        },
        deletedAt: {
          lte: expiresBefore,
        },
      },
    });

    return result.count;
  }

  async hardDeleteExpiredClips(
    expiresBefore: Date,
    limit: number,
  ): Promise<number> {
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
      },
    });

    if (clips.length === 0) {
      return 0;
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

    return result.count;
  }

  private async findClipCursor(
    params: FindTrashItemsParams,
  ): Promise<TrashCursor | null> {
    if (!params.cursor) {
      return null;
    }

    return this.prisma.clip.findFirst({
      where: {
        id: params.cursor,
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
  }

  private async findFolderCursor(
    params: FindTrashItemsParams,
  ): Promise<TrashCursor | null> {
    if (!params.cursor) {
      return null;
    }

    return this.prisma.folder.findFirst({
      where: {
        id: params.cursor,
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
  }
}

type TrashCursor = {
  id: string;
  deletedAt: Date | null;
};

function buildClipDeletedAtCursorWhere(
  cursor: TrashCursor,
): Prisma.ClipWhereInput[] {
  if (!cursor.deletedAt) {
    return [];
  }

  return [
    {
      deletedAt: {
        lt: cursor.deletedAt,
      },
    },
    {
      deletedAt: cursor.deletedAt,
      id: {
        lt: cursor.id,
      },
    },
  ];
}

function buildFolderDeletedAtCursorWhere(
  cursor: TrashCursor,
): Prisma.FolderWhereInput[] {
  if (!cursor.deletedAt) {
    return [];
  }

  return [
    {
      deletedAt: {
        lt: cursor.deletedAt,
      },
    },
    {
      deletedAt: cursor.deletedAt,
      id: {
        lt: cursor.id,
      },
    },
  ];
}
