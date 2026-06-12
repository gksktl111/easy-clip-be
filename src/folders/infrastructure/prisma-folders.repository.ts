import { Injectable } from '@nestjs/common';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateFolderParams,
  CreateFolderTagParams,
  FolderOrderParams,
  FoldersRepository,
} from '../domain/folders.repository';
import { Folder } from '../domain/folder.types';
import { FolderTag } from '../domain/folder-tag.types';

@Injectable()
export class PrismaFoldersRepository implements FoldersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPersonalWorkspaceId(userId: string): Promise<string | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        ownerUserId: userId,
      },
      select: { id: true },
    });

    return workspace?.id ?? null;
  }

  async getOrCreatePersonalWorkspaceId(userId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.upsert({
        where: {
          ownerUserId: userId,
        },
        update: {},
        create: {
          name: 'Personal Workspace',
          ownerUserId: userId,
        },
        select: { id: true },
      });

      await tx.subscription.upsert({
        where: {
          workspaceId: workspace.id,
        },
        update: {},
        create: {
          workspaceId: workspace.id,
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          autoRenew: false,
          currentPeriodEnd: null,
        },
      });

      return workspace.id;
    });
  }

  async findFoldersByWorkspaceId(workspaceId: string): Promise<Folder[]> {
    return this.prisma.folder.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
  }

  async findPersonalFolderById(
    userId: string,
    folderId: string,
  ): Promise<Folder | null> {
    return this.prisma.folder.findFirst({
      where: {
        id: folderId,
        deletedAt: null,
        workspace: {
          ownerUserId: userId,
        },
      },
    });
  }

  async findFolderById(folderId: string): Promise<Folder | null> {
    return this.prisma.folder.findUnique({
      where: { id: folderId },
    });
  }

  async findFolderByIdInWorkspace(
    folderId: string,
    workspaceId: string,
  ): Promise<Folder | null> {
    return this.prisma.folder.findFirst({
      where: {
        id: folderId,
        deletedAt: null,
        workspaceId,
      },
    });
  }

  async findTagsByFolderId(folderId: string): Promise<FolderTag[]> {
    return (this.prisma.tag as unknown as {
      findMany(args: unknown): Promise<FolderTag[]>;
    }).findMany({
      where: {
        folderId,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async findTagByIdInFolder(
    folderId: string,
    tagId: string,
  ): Promise<FolderTag | null> {
    return (this.prisma.tag as unknown as {
      findFirst(args: unknown): Promise<FolderTag | null>;
    }).findFirst({
      where: {
        id: tagId,
        folderId,
      },
    });
  }

  async findTagByNameInFolder(
    folderId: string,
    name: string,
  ): Promise<FolderTag | null> {
    return (this.prisma.tag as unknown as {
      findFirst(args: unknown): Promise<FolderTag | null>;
    }).findFirst({
      where: {
        folderId,
        name,
      },
    });
  }

  async findLastFolderOrder(workspaceId: string): Promise<number | null> {
    const lastFolder = await this.prisma.folder.findFirst({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return lastFolder?.order ?? null;
  }

  async createFolder(params: CreateFolderParams): Promise<Folder> {
    return this.prisma.folder.create({
      data: {
        name: params.name,
        order: params.order,
        workspaceId: params.workspaceId,
      },
    });
  }

  async createFolderTag(params: CreateFolderTagParams): Promise<FolderTag> {
    return (this.prisma.tag as unknown as {
      create(args: unknown): Promise<FolderTag>;
    }).create({
      data: {
        folderId: params.folderId,
        name: params.name,
      },
    });
  }

  async updateFolderName(folderId: string, name: string): Promise<Folder> {
    return this.prisma.folder.update({
      where: { id: folderId },
      data: { name },
    });
  }

  async updateFolderTagName(tagId: string, name: string): Promise<FolderTag> {
    return (this.prisma.tag as unknown as {
      update(args: unknown): Promise<FolderTag>;
    }).update({
      where: { id: tagId },
      data: { name },
    });
  }

  async updateFolderOrder(folderId: string, order: number): Promise<Folder> {
    return this.prisma.folder.update({
      where: { id: folderId },
      data: { order },
    });
  }

  async deleteFolderTag(tagId: string): Promise<void> {
    await this.prisma.tag.delete({
      where: { id: tagId },
    });
  }

  async softDeleteFolderWithClips(folderId: string): Promise<Folder> {
    return this.prisma.$transaction(async (tx) => {
      const deletedAt = new Date();

      await tx.clip.updateMany({
        where: {
          folderId,
          deletedAt: null,
        },
        data: {
          deletedAt,
        },
      });

      return tx.folder.update({
        where: { id: folderId },
        data: { deletedAt },
      });
    });
  }

  async findPreviousFolderOrder(
    params: FolderOrderParams,
  ): Promise<number | null> {
    const previous = await this.prisma.folder.findFirst({
      where: {
        workspaceId: params.workspaceId,
        deletedAt: null,
        order: { lt: params.referenceOrder },
        id: { not: params.excludeId },
      },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return previous?.order ?? null;
  }

  async findNextFolderOrder(params: FolderOrderParams): Promise<number | null> {
    const next = await this.prisma.folder.findFirst({
      where: {
        workspaceId: params.workspaceId,
        deletedAt: null,
        order: { gt: params.referenceOrder },
        id: { not: params.excludeId },
      },
      orderBy: { order: 'asc' },
      select: { order: true },
    });

    return next?.order ?? null;
  }
}
