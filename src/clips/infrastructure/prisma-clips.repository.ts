import { assertClipIncrease } from 'src/shared/application/clip-limit';
import { lockClipQuota } from 'src/shared/infrastructure/prisma-clip-limit';
import {
  assertFolderAccess,
  FolderAccess,
  lockWorkspaceAccess,
  resolveFolderAccess,
  withClipAccess,
} from 'src/shared/infrastructure/prisma-folder-access';
import { ApplicationError } from 'src/shared/application/application.error';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ClipSearchTarget,
  ClipsRepository,
  CreateClipParams,
  FindClipsParams,
  FindRecentClipsParams,
  ReplaceClipTagsParams,
  UpdateClipParams,
  UpdatedClip,
} from '../domain/clips.repository';
import {
  Clip,
  ClipListItem,
  PersonalFolder,
  RecentClipItem,
  Tag,
} from '../domain/clip.types';

@Injectable()
export class PrismaClipsRepository implements ClipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPersonalFolderById(
    userId: string,
    folderId: string,
  ): Promise<PersonalFolder | null> {
    return this.withReadAccess(userId, null, async (tx, access) => {
      const folder = await tx.folder.findFirst({
        where: {
          id: folderId,
          workspaceId: access.workspaceId,
          deletedAt: null,
        },
        select: { id: true, workspaceId: true },
      });
      if (folder) assertFolderAccess(access, folder.id);
      return folder;
    });
  }

  async findClipByIdForUser(
    userId: string,
    clipId: string,
  ): Promise<Clip | null> {
    return this.withReadAccess(userId, null, async (tx, access) => {
      const clip = await tx.clip.findFirst({
        where: {
          id: clipId,
          workspaceId: access.workspaceId,
          deletedAt: null,
          folder: { deletedAt: null },
        },
      });
      if (clip) assertFolderAccess(access, clip.folderId);
      return clip;
    });
  }

  async findClips(params: FindClipsParams): Promise<ClipListItem[]> {
    return this.withReadAccess(params.userId, [], async (tx, access) => {
      if (params.folderId) {
        const folder = await tx.folder.findFirst({
          where: {
            id: params.folderId,
            workspaceId: access.workspaceId,
            deletedAt: null,
          },
        });
        if (!folder)
          throw new ApplicationError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
        assertFolderAccess(access, folder.id);
      }
      const searchTarget = await this.resolveSearchTarget(tx, access, params);
      const where = this.buildWhere({ ...params, searchTarget }, access);
      if (
        params.cursor &&
        !(await tx.clip.findFirst({
          where: { ...where, id: params.cursor },
          select: { id: true },
        }))
      ) {
        throw new ApplicationError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }
      const clips = await tx.clip.findMany({
        where,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        take: params.limit + 1,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: this.clipIncludes(params.userId),
      });
      return clips.map(({ tags, likes, ...clip }) => ({
        ...clip,
        tags: tags.map((tag) => tag.tag),
        likeByMe: likes.length > 0,
      }));
    });
  }

  async findRecentClips(
    params: FindRecentClipsParams,
  ): Promise<RecentClipItem[]> {
    return this.withReadAccess(params.userId, [], async (tx, access) => {
      const searchTarget = await this.resolveSearchTarget(
        tx,
        access,
        params,
        true,
      );
      const where = {
        userId: params.userId,
        clip: this.buildWhere({ ...params, searchTarget }, access),
      };
      if (
        params.cursor &&
        !(await tx.clipView.findFirst({
          where: { ...where, id: params.cursor },
          select: { id: true },
        }))
      ) {
        throw new ApplicationError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }
      const views = await tx.clipView.findMany({
        where,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        take: params.limit + 1,
        orderBy: [{ viewedAt: 'desc' }, { id: 'desc' }],
        include: { clip: { include: this.clipIncludes(params.userId) } },
      });
      return views.map(({ id, clip: { tags, likes, ...clip } }) => ({
        viewId: id,
        ...clip,
        tags: tags.map((tag) => tag.tag),
        likeByMe: likes.length > 0,
      }));
    });
  }

  async findRecentViewedClipIds(
    userId: string,
    limit: number,
  ): Promise<string[]> {
    return this.withReadAccess(userId, [], async (tx, access) => {
      const views = await tx.clipView.findMany({
        where: { userId, clip: this.buildWhere({ userId }, access) },
        orderBy: [{ viewedAt: 'desc' }, { clipId: 'desc' }],
        take: limit,
        select: { clipId: true },
      });
      return views.map((view) => view.clipId);
    });
  }

  async findClipsByIdsForUser(
    userId: string,
    clipIds: string[],
  ): Promise<ClipListItem[]> {
    if (!clipIds.length) return [];
    return this.withReadAccess(userId, [], async (tx, access) => {
      const clips = await tx.clip.findMany({
        where: { ...this.buildWhere({ userId }, access), id: { in: clipIds } },
        include: this.clipIncludes(userId),
      });
      return clips.map(({ tags, likes, ...clip }) => ({
        ...clip,
        tags: tags.map((tag) => tag.tag),
        likeByMe: likes.length > 0,
      }));
    });
  }

  async hasTitleMatches(
    params: Omit<FindClipsParams, 'cursor' | 'limit'> & { q: string },
  ): Promise<boolean> {
    return this.withReadAccess(params.userId, false, async (tx, access) =>
      Boolean(
        await tx.clip.findFirst({
          where: this.buildWhere({ ...params, searchTarget: 'title' }, access),
          select: { id: true },
        }),
      ),
    );
  }

  async hasRecentTitleMatches(
    params: Omit<FindRecentClipsParams, 'cursor' | 'limit'> & { q: string },
  ): Promise<boolean> {
    return this.withReadAccess(params.userId, false, async (tx, access) =>
      Boolean(
        await tx.clipView.findFirst({
          where: {
            userId: params.userId,
            clip: this.buildWhere({ ...params, searchTarget: 'title' }, access),
          },
          select: { id: true },
        }),
      ),
    );
  }

  async isClipMatchingQuery(
    params: Omit<FindClipsParams, 'cursor' | 'limit'> & {
      clipId: string;
      searchTarget: ClipSearchTarget;
    },
  ): Promise<boolean> {
    return this.withReadAccess(params.userId, false, async (tx, access) =>
      Boolean(
        await tx.clip.findFirst({
          where: { ...this.buildWhere(params, access), id: params.clipId },
          select: { id: true },
        }),
      ),
    );
  }

  async isRecentCursorMatchingQuery(
    params: Omit<FindRecentClipsParams, 'cursor' | 'limit'> & {
      viewId: string;
      searchTarget: ClipSearchTarget;
    },
  ): Promise<boolean> {
    return this.withReadAccess(params.userId, false, async (tx, access) =>
      Boolean(
        await tx.clipView.findFirst({
          where: {
            userId: params.userId,
            id: params.viewId,
            clip: this.buildWhere(params, access),
          },
          select: { id: true },
        }),
      ),
    );
  }

  async createClipView(userId: string, clipId: string): Promise<void> {
    await withClipAccess(
      this.prisma,
      clipId,
      async (tx) => {
        await tx.clipView.upsert({
          where: { userId_clipId: { userId, clipId } },
          create: { userId, clipId, viewedAt: new Date() },
          update: { viewedAt: new Date() },
        });
      },
      userId,
    );
  }

  async isClipLikedByUser(userId: string, clipId: string): Promise<boolean> {
    return this.withReadAccess(userId, false, async (tx, access) =>
      Boolean(
        await tx.clipLike.findFirst({
          where: { userId, clipId, clip: this.buildWhere({ userId }, access) },
          select: { id: true },
        }),
      ),
    );
  }

  async createClipLike(userId: string, clipId: string): Promise<void> {
    await withClipAccess(
      this.prisma,
      clipId,
      async (tx) => {
        await tx.clipLike.createMany({
          data: { userId, clipId },
          skipDuplicates: true,
        });
      },
      userId,
    );
  }

  async deleteClipLike(userId: string, clipId: string): Promise<void> {
    await withClipAccess(
      this.prisma,
      clipId,
      async (tx) => {
        await tx.clipLike.deleteMany({ where: { userId, clipId } });
      },
      userId,
    );
  }

  async createClip(userId: string, params: CreateClipParams): Promise<Clip> {
    return this.prisma.$transaction(async (tx) => {
      const workspaceId = await lockClipQuota(tx, userId);
      await tx.$queryRaw`SELECT "id" FROM "Folder" WHERE "id" = ${params.folderId} FOR UPDATE`;
      const folder = await tx.folder.findFirst({
        where: { id: params.folderId, workspaceId, deletedAt: null },
      });
      if (!folder || params.workspaceId !== workspaceId)
        throw new ApplicationError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
      const quota = await resolveFolderAccess(tx, workspaceId);
      assertFolderAccess(quota, folder.id);
      const count = await tx.clip.count({
        where: { folderId: folder.id, deletedAt: null },
      });
      assertClipIncrease(quota, folder.id, count, 1);
      return tx.clip.create({
        data: {
          type: params.type,
          title: params.title,
          folderId: folder.id,
          workspaceId,
          textContent: params.textContent,
          colorHex: params.colorHex,
          imageUrl: params.imageUrl,
        },
      });
    });
  }

  async isCreatedImageReferenced(
    userId: string,
    imageUrl: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // 신규 클립 INSERT는 아직 보이지 않을 수 있으므로 생성과 같은 구독 잠금을 기다린다.
      const workspaceId = await lockClipQuota(tx, userId);
      return (
        (await tx.clip.findFirst({
          where: { workspaceId, imageUrl },
          select: { id: true },
        })) !== null
      );
    });
  }

  async updateClip(
    userId: string,
    clipId: string,
    params: UpdateClipParams,
  ): Promise<UpdatedClip | null> {
    return withClipAccess(
      this.prisma,
      clipId,
      async (tx, _access, previous) => {
        const clip = await tx.clip.update({
          where: { id: clipId },
          // 이름만 바꾸면 콘텐츠를 재저장하지 않는다. 동시 이미지 교체 결과도 보존한다.
          data:
            'type' in params
              ? {
                  type: params.type,
                  title: params.title,
                  textContent: params.textContent,
                  colorHex: params.colorHex,
                  imageUrl: params.imageUrl,
                }
              : { title: params.title },
        });
        return { clip, previousImageUrl: previous.imageUrl };
      },
      userId,
    );
  }

  async isClipImageReferenced(
    clipId: string,
    imageUrl: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // 저장 응답이 유실돼도 앞선 쓰기의 커밋/롤백이 끝난 뒤 참조를 확인한다.
      await tx.$queryRaw`SELECT "id" FROM "Clip" WHERE "id" = ${clipId} FOR UPDATE`;
      const clip = await tx.clip.findUnique({
        where: { id: clipId },
        select: { imageUrl: true },
      });
      return clip?.imageUrl === imageUrl;
    });
  }

  async replaceClipTags(params: ReplaceClipTagsParams): Promise<Tag[]> {
    return withClipAccess(
      this.prisma,
      params.clipId,
      async (tx, _access, clip) => {
        const tags: Tag[] = [];
        for (const name of params.tagNames) {
          tags.push(
            await tx.tag.upsert({
              where: { folderId_name: { folderId: clip.folderId, name } },
              create: { folderId: clip.folderId, name },
              update: {},
              select: { id: true, name: true, backgroundColor: true },
            }),
          );
        }
        await tx.clipTag.deleteMany({ where: { clipId: clip.id } });
        if (tags.length)
          await tx.clipTag.createMany({
            data: tags.map((tag) => ({ clipId: clip.id, tagId: tag.id })),
          });
        return tags;
      },
      params.userId,
    );
  }

  async softDeleteClip(userId: string, clipId: string): Promise<Clip> {
    return withClipAccess(
      this.prisma,
      clipId,
      (tx) =>
        tx.clip.update({
          where: { id: clipId },
          data: { deletedAt: new Date() },
        }),
      userId,
    );
  }

  async softDeleteClips(userId: string, clipIds: string[]): Promise<number> {
    if (!clipIds.length) return 0;
    return this.prisma.$transaction(async (tx) => {
      const workspaceId = await lockClipQuota(tx, userId);
      const ids = [...new Set(clipIds)];
      const candidates = await tx.clip.findMany({
        where: { id: { in: ids }, workspaceId },
        select: { id: true, folderId: true },
      });
      if (candidates.length !== ids.length)
        throw new ApplicationError('NOT_FOUND', '클립을 찾을 수 없습니다.');
      const folderIds = [...new Set(candidates.map((clip) => clip.folderId))];
      await tx.$queryRaw`SELECT "id" FROM "Folder" WHERE "id" IN (${Prisma.join(folderIds)}) ORDER BY "id" FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Clip" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
      const clips = await tx.clip.findMany({
        where: {
          id: { in: ids },
          workspaceId,
          deletedAt: null,
          folder: { deletedAt: null },
        },
      });
      if (clips.length !== ids.length)
        throw new ApplicationError('NOT_FOUND', '클립을 찾을 수 없습니다.');
      const access = await resolveFolderAccess(tx, workspaceId);
      for (const clip of clips) assertFolderAccess(access, clip.folderId);
      const result = await tx.clip.updateMany({
        where: { id: { in: ids }, workspaceId },
        data: { deletedAt: new Date() },
      });
      return result.count;
    });
  }

  async softDeleteAllClipsInFolder(
    userId: string,
    folderId: string,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const workspaceId = await lockClipQuota(tx, userId);
      const candidate = await tx.folder.findFirst({
        where: { id: folderId, workspaceId },
        select: { id: true },
      });
      if (!candidate)
        throw new ApplicationError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
      await tx.$queryRaw`SELECT "id" FROM "Folder" WHERE "id" = ${folderId} FOR UPDATE`;
      const folder = await tx.folder.findFirst({
        where: { id: folderId, workspaceId, deletedAt: null },
      });
      if (!folder)
        throw new ApplicationError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
      const access = await resolveFolderAccess(tx, workspaceId);
      assertFolderAccess(access, folderId);
      const candidates = await tx.clip.findMany({
        where: { folderId, deletedAt: null },
        select: { id: true },
      });
      if (!candidates.length) return 0;
      await tx.$queryRaw`SELECT "id" FROM "Clip" WHERE "id" IN (${Prisma.join(candidates.map((clip) => clip.id))}) ORDER BY "id" FOR UPDATE`;
      const result = await tx.clip.updateMany({
        where: { folderId, workspaceId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return result.count;
    });
  }

  private async withReadAccess<T>(
    userId: string,
    missing: T,
    read: (tx: Prisma.TransactionClient, access: FolderAccess) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { ownerUserId: userId },
        select: { id: true },
      });
      if (!workspace) return missing;
      const access = await lockWorkspaceAccess(tx, workspace.id);
      return read(tx, access);
    });
  }

  private clipIncludes(userId: string) {
    return {
      tags: {
        select: {
          tag: { select: { id: true, name: true, backgroundColor: true } },
        },
      },
      likes: { where: { userId }, select: { id: true } },
    } as const;
  }

  private async resolveSearchTarget(
    tx: Prisma.TransactionClient,
    access: FolderAccess,
    params: Omit<FindClipsParams, 'cursor' | 'limit'>,
    recent = false,
  ): Promise<ClipSearchTarget | undefined> {
    if (!params.q) return undefined;
    const where = this.buildWhere({ ...params, searchTarget: 'title' }, access);
    const match = recent
      ? await tx.clipView.findFirst({
          where: { userId: params.userId, clip: where },
          select: { id: true },
        })
      : await tx.clip.findFirst({ where, select: { id: true } });
    return match ? 'title' : 'tag';
  }

  private buildWhere(
    params: Omit<FindClipsParams, 'cursor' | 'limit'>,
    access: FolderAccess,
  ): Prisma.ClipWhereInput {
    const { userId, folderId, workspaceId, type, q, searchTarget, likedOnly } =
      params;

    const where: Prisma.ClipWhereInput = {
      deletedAt: null,
      workspaceId: access.workspaceId,
      workspace: { ownerUserId: userId },
      folder: { deletedAt: null },
      AND: [
        ...(folderId ? [{ folderId }] : []),
        ...(workspaceId ? [{ workspaceId }] : []),
        ...(access.effectivePlan === 'FREE'
          ? [
              {
                folderId: {
                  in: access.accessibleFolderId
                    ? [access.accessibleFolderId]
                    : [],
                },
              },
            ]
          : []),
      ],
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
      ...(likedOnly
        ? {
            likes: {
              some: {
                userId,
              },
            },
          }
        : {}),
    };

    return where;
  }
}
