import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFolderDto } from './dtos/create-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  async createFolder(userId: string, dto: CreateFolderDto) {
    const workspaceId = await this.getOrCreatePersonalWorkspaceId(userId);

    const lastFolder = await this.prisma.folder.findFirst({
      where: { workspaceId },
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

  private async getOrCreatePersonalWorkspaceId(userId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        ownerUserId: userId,
        type: WorkspaceType.PERSONAL,
      },
      select: { id: true },
    });

    if (workspace) {
      return workspace.id;
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
