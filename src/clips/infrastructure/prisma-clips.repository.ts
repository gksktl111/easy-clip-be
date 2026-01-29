import { Injectable } from '@nestjs/common';
import { Prisma, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ClipSearchTarget,
  ClipsRepository,
  CreateClipParams,
  FindClipsParams,
  UpdateClipParams,
} from '../domain/clips.repository';
import { Clip, ClipListItem, PersonalFolder } from '../domain/clip.types';

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

  async findClips(params: FindClipsParams): Promise<ClipListItem[]> {
    const { userId, cursor, limit } = params;
    const where = this.buildWhere(params);

    const clips = await this.prisma.clip.findMany({
      where,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    return clips.map(({ tags, likes, ...clip }) => ({
      ...clip,
      tags: tags.map((tag) => tag.tag),
      likedByMe: likes.length > 0,
    }));
  }

  async hasTitleMatches(
    params: Omit<FindClipsParams, 'cursor' | 'limit'> & { q: string },
  ): Promise<boolean> {
    const where = this.buildWhere({ ...params, searchTarget: 'title' });
    const match = await this.prisma.clip.findFirst({
      where,
      select: { id: true },
    });

    return Boolean(match);
  }

  async isClipMatchingQuery(
    params: Omit<FindClipsParams, 'cursor' | 'limit'> & {
      clipId: string;
      searchTarget: ClipSearchTarget;
    },
  ): Promise<boolean> {
    const where = this.buildWhere(params);
    const match = await this.prisma.clip.findFirst({
      where: {
        ...where,
        id: params.clipId,
      },
      select: { id: true },
    });

    return Boolean(match);
  }

  async isClipLikedByUser(userId: string, clipId: string): Promise<boolean> {
    const like = await this.prisma.clipLike.findUnique({
      where: {
        userId_clipId: {
          userId,
          clipId,
        },
      },
      select: { id: true },
    });

    return Boolean(like);
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

  private buildWhere(
    params: Omit<FindClipsParams, 'cursor' | 'limit'>,
  ): Prisma.ClipWhereInput {
    const { userId, folderId, workspaceId, type, q, searchTarget, likedOnly } =
      params;

    const where: Prisma.ClipWhereInput = {
      deletedAt: null,
      ...(folderId
        ? {
            folderId,
            ...(workspaceId ? { workspaceId } : {}),
          }
        : {
            workspace: {
              ownerUserId: userId,
              type: WorkspaceType.PERSONAL,
            },
          }),
      ...(type && type !== 'ALL' ? { type } : {}),
      ...(q && searchTarget === 'title'
        ? {
            title: {
              contains: q,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(q && searchTarget === 'tag'
        ? {
            tags: {
              some: {
                tag: {
                  name: {
                    contains: q,
                    mode: 'insensitive',
                  },
                },
              },
            },
          }
        : {}),
      ...(likedOnly === true
        ? {
            likes: {
              some: {
                userId,
              },
            },
          }
        : {}),
      ...(likedOnly === false
        ? {
            likes: {
              none: {
                userId,
              },
            },
          }
        : {}),
    };

    return where;
  }
}
