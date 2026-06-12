import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TrashRepository } from '../domain/trash.repository';
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

  async hardDeleteClip(clipId: string): Promise<void> {
    await this.prisma.clip.delete({
      where: { id: clipId },
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
}
