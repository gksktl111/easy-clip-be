import { Injectable } from '@nestjs/common';
import { Prisma, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ClipSearchTarget,
  ClipsRepository,
  CreateClipParams,
  FindClipsParams,
  FindRecentClipsParams,
  UpdateClipParams,
} from '../domain/clips.repository';
import {
  Clip,
  ClipListItem,
  PersonalFolder,
  RecentClipItem,
} from '../domain/clip.types';

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
      likeByMe: likes.length > 0,
    }));
  }

  async findRecentClips(
    params: FindRecentClipsParams,
  ): Promise<RecentClipItem[]> {
    const { userId, cursor, limit } = params;
    const clipWhere = this.buildWhere({
      userId,
      type: params.type,
      q: params.q,
      searchTarget: params.searchTarget,
      likedOnly: params.likedOnly,
    });

    const views = await this.prisma.clipView.findMany({
      where: {
        userId,
        clip: clipWhere,
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      orderBy: [{ viewedAt: 'desc' }, { id: 'desc' }],
      include: {
        clip: {
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
        },
      },
    });

    return views.map(({ id, clip }) => ({
      viewId: id,
      ...clip,
      tags: clip.tags.map((tag) => tag.tag),
      likeByMe: clip.likes.length > 0,
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

  async hasRecentTitleMatches(
    params: Omit<FindRecentClipsParams, 'cursor' | 'limit'> & { q: string },
  ): Promise<boolean> {
    const clipWhere = this.buildWhere({
      userId: params.userId,
      type: params.type,
      q: params.q,
      searchTarget: 'title',
      likedOnly: undefined,
    });
    const match = await this.prisma.clipView.findFirst({
      where: {
        userId: params.userId,
        clip: clipWhere,
      },
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

  async isRecentCursorMatchingQuery(
    params: Omit<FindRecentClipsParams, 'cursor' | 'limit'> & {
      viewId: string;
      searchTarget: ClipSearchTarget;
    },
  ): Promise<{ liked: boolean } | null> {
    const clipWhere = this.buildWhere({
      userId: params.userId,
      type: params.type,
      q: params.q,
      searchTarget: params.searchTarget,
      likedOnly: undefined,
    });
    const match = await this.prisma.clipView.findFirst({
      where: {
        id: params.viewId,
        userId: params.userId,
        clip: clipWhere,
      },
      select: {
        clip: {
          select: {
            likes: {
              where: { userId: params.userId },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!match) {
      return null;
    }

    return { liked: match.clip.likes.length > 0 };
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

  async createClipLike(userId: string, clipId: string): Promise<void> {
    await this.prisma.clipLike.createMany({
      data: {
        userId,
        clipId,
      },
      skipDuplicates: true,
    });
  }

  async deleteClipLike(userId: string, clipId: string): Promise<void> {
    await this.prisma.clipLike.deleteMany({
      where: {
        userId,
        clipId,
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
      ...(type ? { type } : {}),
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
