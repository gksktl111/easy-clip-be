import { Injectable } from '@nestjs/common';
import { WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ClipsRepository,
  CreateClipParams,
  UpdateClipParams,
} from '../domain/clips.repository';
import { Clip, PersonalFolder } from '../domain/clip.types';

@Injectable()
export class PrismaClipsRepository implements ClipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPersonalFolderById(
    userId: string,
    folderId: string,
  ): Promise<PersonalFolder | null> {
    return this.prisma.folder.findFirst({
      where: {
        id: folderId,
        deletedAt: null,
        workspace: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });
  }

  async findClipByIdForUser(
    userId: string,
    clipId: string,
  ): Promise<Clip | null> {
    return this.prisma.clip.findFirst({
      where: {
        id: clipId,
        deletedAt: null,
        workspace: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
    });
  }

  async createClip(params: CreateClipParams): Promise<Clip> {
    return this.prisma.clip.create({
      data: {
        type: params.type,
        title: params.title,
        folderId: params.folderId,
        workspaceId: params.workspaceId,
        textContent: params.textContent,
        colorHex: params.colorHex,
        imageUrl: params.imageUrl,
      },
    });
  }

  async updateClip(clipId: string, params: UpdateClipParams): Promise<Clip> {
    return this.prisma.clip.update({
      where: { id: clipId },
      data: {
        type: params.type,
        title: params.title,
        folderId: params.folderId,
        workspaceId: params.workspaceId,
        textContent: params.textContent,
        colorHex: params.colorHex,
        imageUrl: params.imageUrl,
      },
    });
  }

  async softDeleteClip(clipId: string): Promise<Clip> {
    return this.prisma.clip.update({
      where: { id: clipId },
      data: { deletedAt: new Date() },
    });
  }
}
