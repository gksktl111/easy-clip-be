import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
        folder: {
          deletedAt: null,
        },
        workspace: {
          ownerUserId: userId,
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

  async findRecentViewedClipIds(
    userId: string,
    limit: number,
  ): Promise<string[]> {
    const views = await this.prisma.clipView.findMany({
      where: {
        userId,
        clip: {
          deletedAt: null,
          folder: {
            deletedAt: null,
          },
          workspace: {
            ownerUserId: userId,
          },
        },
      },
      orderBy: [{ viewedAt: 'desc' }, { clipId: 'desc' }],
      take: limit,
      select: {
        clipId: true,
      },
    });

    return views.map((view) => view.clipId);
  }

  async findClipsByIdsForUser(
    userId: string,
    clipIds: string[],
  ): Promise<ClipListItem[]> {
    if (clipIds.length === 0) {
      return [];
    }

    const clips = await this.prisma.clip.findMany({
      where: {
        id: {
          in: clipIds,
        },
        deletedAt: null,
        folder: {
          deletedAt: null,
        },
        workspace: {
          ownerUserId: userId,
        },
      },
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

  async createClipView(userId: string, clipId: string): Promise<void> {
    await this.prisma.clipView.upsert({
      where: {
        userId_clipId: {
          userId,
          clipId,
        },
      },
      create: {
        userId,
        clipId,
        viewedAt: new Date(),
      },
      update: {
        viewedAt: new Date(),
      },
    });
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

  async softDeleteClips(clipIds: string[]): Promise<number> {
    const result = await this.prisma.clip.updateMany({
      where: {
        id: {
          in: clipIds,
        },
        deletedAt: null,
        folder: {
          deletedAt: null,
        },
      },
      data: { deletedAt: new Date() },
    });

    return result.count;
  }

  async softDeleteAllClipsInFolder(
    userId: string,
    folderId: string,
  ): Promise<number> {
    const result = await this.prisma.clip.updateMany({
      where: {
        folderId,
        deletedAt: null,
        folder: {
          deletedAt: null,
          workspace: {
            ownerUserId: userId,
          },
        },
        workspace: {
          ownerUserId: userId,
        },
      },
      data: { deletedAt: new Date() },
    });

    return result.count;
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
            folder: {
              deletedAt: null,
            },
          }
        : {
            workspace: {
              ownerUserId: userId,
            },
            folder: {
              deletedAt: null,
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
