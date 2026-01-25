import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { ReorderFolderDto } from './dtos/reorder-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  // 개인 워크스페이스 기준 폴더 목록을 조회한다.
  async getFolders(userId: string) {
    const workspaceId = await this.findPersonalWorkspaceId(userId);

    if (!workspaceId) {
      return [];
    }

    return this.prisma.folder.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
  }

  // 개인 워크스페이스 소유 폴더를 단건 조회한다.
  async getFolderById(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        deletedAt: null,
        workspace: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('폴더를 찾을 수 없습니다.');
    }

    return folder;
  }

  // 폴더 이름을 수정한다.
  async updateFolder(userId: string, folderId: string, dto: UpdateFolderDto) {
    const folder = await this.getFolderById(userId, folderId);

    if (!dto.name) {
      return folder;
    }

    return this.prisma.folder.update({
      where: { id: folder.id },
      data: {
        name: dto.name,
      },
    });
  }

  // 기준 폴더를 기반으로 대상 폴더의 순서를 재계산한다.
  async reorderFolder(userId: string, dto: ReorderFolderDto) {
    const { targetId, afterId, beforeId } = dto;

    if ((!afterId && !beforeId) || (afterId && beforeId)) {
      throw new BadRequestException(
        'afterId 또는 beforeId 중 하나만 전달해야 합니다.',
      );
    }

    if (targetId === afterId || targetId === beforeId) {
      throw new BadRequestException('이동 대상과 기준 폴더가 같습니다.');
    }

    const target = await this.prisma.folder.findFirst({
      where: {
        id: targetId,
        deletedAt: null,
        workspace: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
      select: {
        id: true,
        order: true,
        workspaceId: true,
      },
    });

    if (!target) {
      throw new NotFoundException('이동할 폴더를 찾을 수 없습니다.');
    }

    const referenceId = afterId ?? beforeId;

    if (!referenceId) {
      throw new BadRequestException('기준 폴더가 필요합니다.');
    }
    const reference = await this.prisma.folder.findFirst({
      where: {
        id: referenceId,
        deletedAt: null,
        workspaceId: target.workspaceId,
      },
      select: {
        id: true,
        order: true,
      },
    });

    if (!reference) {
      throw new NotFoundException('기준 폴더를 찾을 수 없습니다.');
    }

    let newOrder: number;

    if (beforeId) {
      const previous = await this.prisma.folder.findFirst({
        where: {
          workspaceId: target.workspaceId,
          deletedAt: null,
          order: { lt: reference.order },
          id: { not: target.id },
        },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      newOrder = previous
        ? (previous.order + reference.order) / 2
        : reference.order - 1;
    } else {
      const next = await this.prisma.folder.findFirst({
        where: {
          workspaceId: target.workspaceId,
          deletedAt: null,
          order: { gt: reference.order },
          id: { not: target.id },
        },
        orderBy: { order: 'asc' },
        select: { order: true },
      });

      newOrder = next
        ? (reference.order + next.order) / 2
        : reference.order + 1;
    }

    if (newOrder === target.order) {
      return this.prisma.folder.findUnique({
        where: { id: target.id },
      });
    }

    return this.prisma.folder.update({
      where: { id: target.id },
      data: { order: newOrder },
    });
  }

  // 폴더를 소프트 삭제한다.
  async deleteFolder(userId: string, folderId: string) {
    const folder = await this.getFolderById(userId, folderId);

    return this.prisma.folder.update({
      where: { id: folder.id },
      data: { deletedAt: new Date() },
    });
  }

  // 폴더를 생성하고 마지막 순서 다음 값으로 배치한다.
  async createFolder(userId: string, dto: CreateFolderDto) {
    const workspaceId = await this.getOrCreatePersonalWorkspaceId(userId);

    const lastFolder = await this.prisma.folder.findFirst({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const nextOrder = lastFolder ? lastFolder.order + 1 : 1;

    return this.prisma.folder.create({
      data: {
        name: dto.name,
        order: nextOrder,
        workspaceId,
      },
    });
  }

  private async findPersonalWorkspaceId(
    userId: string,
  ): Promise<string | null> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        ownerUserId: userId,
        type: WorkspaceType.PERSONAL,
      },
      select: { id: true },
    });

    return workspace?.id ?? null;
  }

  private async getOrCreatePersonalWorkspaceId(
    userId: string,
  ): Promise<string> {
    const workspaceId = await this.findPersonalWorkspaceId(userId);

    if (workspaceId) {
      return workspaceId;
    }

    const created = await this.prisma.workspace.create({
      data: {
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

    if (!created) {
      throw new InternalServerErrorException(
        '개인 워크스페이스를 생성할 수 없습니다.',
      );
    }

    return created.id;
  }
}
