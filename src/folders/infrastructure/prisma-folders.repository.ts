import { Injectable } from '@nestjs/common';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateFolderParams,
  FindClipsParams,
  FolderOrderParams,
  FoldersRepository,
} from '../domain/folders.repository';
import { Clip, Folder } from '../domain/folder.types';

@Injectable()
export class PrismaFoldersRepository implements FoldersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPersonalWorkspaceId(userId: string): Promise<string | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        ownerUserId_type: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
      select: { id: true },
    });

    return workspace?.id ?? null;
  }

  async getOrCreatePersonalWorkspaceId(userId: string): Promise<string> {
    const workspace = await this.prisma.workspace.upsert({
      where: {
        ownerUserId_type: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
      update: {},
      create: {
        name: 'Personal Workspace',
        type: WorkspaceType.PERSONAL,
        ownerUserId: userId,
        users: {
          create: {
            userId,
            role: WorkspaceRole.OWNER,
          },
        },
      },
      select: { id: true },
    });

    return workspace.id;
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
          type: WorkspaceType.PERSONAL,
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

  async findClipByIdInFolder(
    folderId: string,
    workspaceId: string,
    clipId: string,
  ): Promise<Clip | null> {
    return this.prisma.clip.findFirst({
      where: {
        id: clipId,
        deletedAt: null,
        folderId,
        workspaceId,
      },
    });
  }

  async findClipsByFolder(params: FindClipsParams): Promise<Clip[]> {
    const { folderId, workspaceId, cursor, limit } = params;

    return this.prisma.clip.findMany({
      where: {
        folderId,
        workspaceId,
        deletedAt: null,
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
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

  async updateFolderName(folderId: string, name: string): Promise<Folder> {
    return this.prisma.folder.update({
      where: { id: folderId },
      data: { name },
    });
  }

  async updateFolderOrder(folderId: string, order: number): Promise<Folder> {
    return this.prisma.folder.update({
      where: { id: folderId },
      data: { order },
    });
  }

  async softDeleteFolder(folderId: string): Promise<Folder> {
    return this.prisma.folder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
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
