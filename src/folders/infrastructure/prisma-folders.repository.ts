import {
  lockWorkspaceAccess,
  withFolderAccess,
} from 'src/shared/infrastructure/prisma-folder-access';
import { FolderAccessError } from 'src/shared/application/folder-access';
import { Injectable } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateFolderParams,
  CreateFolderTagParams,
  FolderOrderParams,
  FoldersRepository,
  UpdateFolderTagParams,
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
    const existing = await this.findPersonalWorkspaceId(userId);
    if (existing) return existing;
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
    return this.prisma.$transaction(async (tx) => {
      const access = await lockWorkspaceAccess(tx, workspaceId);
      const folders = await tx.folder.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });
      return folders.map((folder) => ({
        ...folder,
        isLocked:
          access.effectivePlan === 'FREE' &&
          folder.id !== access.accessibleFolderId,
      }));
    });
  }

  async findPersonalFolderById(
    userId: string,
    folderId: string,
    options?: { allowLocked?: boolean },
  ): Promise<Folder | null> {
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        deletedAt: null,
        workspace: { ownerUserId: userId },
      },
    });
    if (!folder) return null;
    return withFolderAccess(
      this.prisma,
      folderId,
      async (tx, access) => ({
        ...(await tx.folder.findUniqueOrThrow({ where: { id: folderId } })),
        isLocked:
          access.effectivePlan === 'FREE' &&
          access.accessibleFolderId !== folderId,
      }),
      options,
    );
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
    return withFolderAccess(this.prisma, folderId, async (tx) => {
      return (
        tx.tag as unknown as {
          findMany(args: unknown): Promise<FolderTag[]>;
        }
      ).findMany({
        where: {
          folderId,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
    });
  }

  async findTagByIdInFolder(
    folderId: string,
    tagId: string,
  ): Promise<FolderTag | null> {
    return withFolderAccess(this.prisma, folderId, async (tx) => {
      return (
        tx.tag as unknown as {
          findFirst(args: unknown): Promise<FolderTag | null>;
        }
      ).findFirst({
        where: {
          id: tagId,
          folderId,
        },
      });
    });
  }

  async findTagByNameInFolder(
    folderId: string,
    name: string,
  ): Promise<FolderTag | null> {
    return withFolderAccess(this.prisma, folderId, async (tx) => {
      return (
        tx.tag as unknown as {
          findFirst(args: unknown): Promise<FolderTag | null>;
        }
      ).findFirst({
        where: {
          folderId,
          name,
        },
      });
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
    return this.prisma.$transaction(async (tx) => {
      const access = await lockWorkspaceAccess(tx, params.workspaceId);
      if (access.effectivePlan === 'FREE') {
        const count = await tx.folder.count({
          where: { workspaceId: params.workspaceId, deletedAt: null },
        });
        if (count > 0 || access.accessibleFolderId) {
          throw new FolderAccessError(
            'PLAN_LIMIT_EXCEEDED',
            'Free에서는 활성 폴더 1개만 만들 수 있습니다. 삭제한 접근 폴더가 있으면 먼저 복구해 주세요.',
          );
        }
      }
      const folder = await tx.folder.create({
        data: {
          name: params.name,
          order: params.order,
          workspaceId: params.workspaceId,
        },
      });
      if (access.effectivePlan === 'FREE') {
        await tx.workspace.update({
          where: { id: params.workspaceId },
          data: { freeAccessibleFolderId: folder.id },
        });
      }
      return { ...folder, isLocked: false };
    });
  }

  async createFolderTag(params: CreateFolderTagParams): Promise<FolderTag> {
    return withFolderAccess(this.prisma, params.folderId, async (tx) => {
      return (
        tx.tag as unknown as {
          create(args: unknown): Promise<FolderTag>;
        }
      ).create({
        data: {
          folderId: params.folderId,
          name: params.name,
          backgroundColor: params.backgroundColor,
        },
      });
    });
  }

  async updateFolderName(folderId: string, name: string): Promise<Folder> {
    return withFolderAccess(this.prisma, folderId, async (tx) => {
      return tx.folder.update({
        where: { id: folderId },
        data: { name },
      });
    });
  }

  async updateFolderTag(
    tagId: string,
    params: UpdateFolderTagParams,
  ): Promise<FolderTag> {
    const tag = await this.prisma.tag.findUniqueOrThrow({
      where: { id: tagId },
      select: { folderId: true },
    });
    return withFolderAccess(this.prisma, tag.folderId, async (tx) => {
      return (
        tx.tag as unknown as {
          update(args: unknown): Promise<FolderTag>;
        }
      ).update({
        where: { id: tagId },
        data: params,
      });
    });
  }

  async updateFolderOrder(folderId: string, order: number): Promise<Folder> {
    return withFolderAccess(this.prisma, folderId, async (tx, access) => {
      if (access.effectivePlan === 'FREE')
        throw new FolderAccessError(
          'FEATURE_NOT_AVAILABLE',
          'Free에서는 폴더 순서를 변경할 수 없습니다.',
        );
      return tx.folder.update({
        where: { id: folderId },
        data: { order },
      });
    });
  }

  async deleteFolderTag(tagId: string): Promise<void> {
    const tag = await this.prisma.tag.findUniqueOrThrow({
      where: { id: tagId },
      select: { folderId: true },
    });
    return withFolderAccess(this.prisma, tag.folderId, async (tx) => {
      await tx.tag.delete({
        where: { id: tagId },
      });
    });
  }

  async softDeleteFolder(folderId: string): Promise<Folder> {
    return withFolderAccess(
      this.prisma,
      folderId,
      async (tx) => {
        return tx.folder.update({
          where: { id: folderId },
          data: { deletedAt: new Date() },
        });
      },
      { allowLocked: true },
    );
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
