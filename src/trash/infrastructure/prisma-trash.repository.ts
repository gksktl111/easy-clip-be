import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  HardDeleteTrashItemsResult,
  TrashRepository,
} from '../domain/trash.repository';
import { TrashClipItem, TrashFolderItem } from '../domain/trash.types';

@Injectable()
export class PrismaTrashRepository implements TrashRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDeletedClips(userId: string): Promise<TrashClipItem[]> {
    return this.prisma.clip.findMany({
      where: {
        deletedAt: {
          not: null,
        },
        workspace: {
          ownerUserId: userId,
        },
      },
      orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
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
    return this.prisma.clip.findFirst({
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
      },
    }) as Promise<TrashClipItem | null>;
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

  async hardDeleteClip(clipId: string): Promise<HardDeleteTrashItemsResult> {
    return this.prisma.$transaction(async (tx) => {
      const clip = await tx.clip.findUnique({
        where: { id: clipId },
        select: { imageUrl: true },
      });

      await tx.clip.delete({
        where: { id: clipId },
      });

      return {
        deletedCount: 1,
        imageUrls: this.compactImageUrls([clip?.imageUrl]),
      };
    });
  }

  async findDeletedFolders(userId: string): Promise<TrashFolderItem[]> {
    return this.prisma.folder.findMany({
      where: {
        deletedAt: {
          not: null,
        },
        workspace: {
          ownerUserId: userId,
        },
      },
      orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
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

  async hardDeleteFolderWithClips(
    folderId: string,
  ): Promise<HardDeleteTrashItemsResult> {
    return this.prisma.$transaction(async (tx) => {
      const imageClips = await tx.clip.findMany({
        where: {
          folderId,
          imageUrl: {
            not: null,
          },
        },
        select: {
          imageUrl: true,
        },
      });

      await tx.clip.deleteMany({
        where: {
          folderId,
        },
      });

      await tx.folder.delete({
        where: { id: folderId },
      });

      return {
        deletedCount: 1,
        imageUrls: this.compactImageUrls(
          imageClips.map((clip) => clip.imageUrl),
        ),
      };
    });
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
}
