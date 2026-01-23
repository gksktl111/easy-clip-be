import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { ReorderFolderDto } from './dto/reorder-folder.dto';
import { FolderEntity } from './entities/folder.entity';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    createFolderDto: CreateFolderDto,
  ): Promise<FolderEntity> {
    const maxOrderFolder = await this.prisma.folder.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { order: 'desc' },
    });

    const newOrder = maxOrderFolder ? maxOrderFolder.order + 1 : 0;

    const folder = await this.prisma.folder.create({
      data: {
        name: createFolderDto.name,
        order: newOrder,
        userId,
      },
    });

    return folder;
  }

  async findAll(userId: string): Promise<FolderEntity[]> {
    const folders = await this.prisma.folder.findMany({
      where: { userId, deletedAt: null },
      orderBy: { order: 'asc' },
    });

    return folders;
  }

  async findOne(id: string, userId: string): Promise<FolderEntity> {
    const folder = await this.prisma.folder.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!folder) {
      throw new NotFoundException(`Folder with ID ${id} not found`);
    }

    return folder;
  }

  async update(
    id: string,
    userId: string,
    updateFolderDto: UpdateFolderDto,
  ): Promise<FolderEntity> {
    await this.findOne(id, userId);

    const folder = await this.prisma.folder.update({
      where: { id },
      data: updateFolderDto,
    });

    return folder;
  }

  async reorder(
    userId: string,
    reorderFolderDto: ReorderFolderDto,
  ): Promise<void> {
    const { folderId, targetFolderId, position } = reorderFolderDto;

    const folderToMove = await this.findOne(folderId, userId);

    if (!folderToMove) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }

    if (targetFolderId) {
      const targetFolder = await this.findOne(targetFolderId, userId);

      if (!targetFolder) {
        throw new NotFoundException(
          `Target folder with ID ${targetFolderId} not found`,
        );
      }
    }

    const allFolders = await this.findAll(userId);

    const filteredFolders = allFolders.filter((f) => f.id !== folderId);

    let newOrder: number;

    if (!targetFolderId) {
      if (position === 'before') {
        newOrder = 0;
      } else {
        newOrder =
          filteredFolders.length > 0
            ? filteredFolders[filteredFolders.length - 1].order + 1
            : 0;
      }
    } else {
      const targetIndex = filteredFolders.findIndex(
        (f) => f.id === targetFolderId,
      );

      if (position === 'before') {
        newOrder =
          targetIndex > 0
            ? (filteredFolders[targetIndex - 1].order +
                filteredFolders[targetIndex].order) /
              2
            : filteredFolders[targetIndex].order - 1;
      } else {
        newOrder =
          targetIndex < filteredFolders.length - 1
            ? (filteredFolders[targetIndex].order +
                filteredFolders[targetIndex + 1].order) /
              2
            : filteredFolders[targetIndex].order + 1;
      }
    }

    await this.prisma.folder.update({
      where: { id: folderId },
      data: { order: newOrder },
    });

    const epsilon = 0.0001;
    const needsReordering = allFolders.some((folder, index) => {
      if (index === allFolders.length - 1) return false;
      return (
        Math.abs(folder.order - allFolders[index + 1].order) < epsilon ||
        folder.order >= allFolders[index + 1].order
      );
    });

    if (needsReordering) {
      const updatedFolders = await this.findAll(userId);
      await Promise.all(
        updatedFolders.map((folder, index) =>
          this.prisma.folder.update({
            where: { id: folder.id },
            data: { order: index },
          }),
        ),
      );
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await this.prisma.folder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
