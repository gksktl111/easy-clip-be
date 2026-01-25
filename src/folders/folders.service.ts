import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

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
