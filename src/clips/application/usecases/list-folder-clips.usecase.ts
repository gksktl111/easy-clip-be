import { Inject, Injectable } from '@nestjs/common';
import { ClipType } from '../../domain/clip.types';
import {
  CLIPS_REPOSITORY,
  ClipSearchTarget,
  ClipTypeFilter,
} from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';
import {
  LIST_CLIPS_LIMIT,
  buildPage,
  normalizeCursor,
  normalizeType,
} from './list-clips.common';

export type ListFolderClipsInput = {
  folderId: string;
  cursor?: string;
  type: ClipTypeFilter;
  q?: string;
};

@Injectable()
export class ListFolderClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(userId: string, input: ListFolderClipsInput) {
    const cursor = normalizeCursor(input.cursor);
    const type = normalizeType(input.type);
    const query = input.q?.trim();

    const folder = await this.clipsRepository.findPersonalFolderById(
      userId,
      input.folderId,
    );

    if (!folder) {
      throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const searchTarget = await this.resolveSearchTarget({
      userId,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
      type,
      q: query,
      likedOnly: undefined,
    });

    const cursorLiked = await this.validateCursor({
      userId,
      cursor,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
      type,
      q: query,
      searchTarget,
    });

    return this.listWithLikedPriority({
      userId,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
      cursor,
      cursorLiked,
      type,
      q: query,
      searchTarget,
    });
  }

  private async resolveSearchTarget({
    userId,
    folderId,
    workspaceId,
    type,
    q,
    likedOnly,
  }: {
    userId: string;
    folderId?: string;
    workspaceId?: string;
    type?: ClipType;
    q?: string;
    likedOnly?: boolean;
  }): Promise<ClipSearchTarget | undefined> {
    if (!q) {
      return undefined;
    }

    const hasTitleMatches = await this.clipsRepository.hasTitleMatches({
      userId,
      folderId,
      workspaceId,
      type,
      q,
      searchTarget: 'title',
      likedOnly,
    });

    return hasTitleMatches ? 'title' : 'tag';
  }

  private async validateCursor({
    userId,
    cursor,
    folderId,
    workspaceId,
    type,
    q,
    searchTarget,
  }: {
    userId: string;
    cursor: string | undefined;
    folderId: string;
    workspaceId: string;
    type?: ClipType;
    q?: string;
    searchTarget?: ClipSearchTarget;
  }) {
    if (!cursor) {
      return null;
    }

    const cursorClip = await this.clipsRepository.findClipByIdForUser(
      userId,
      cursor,
    );

    if (!cursorClip || cursorClip.folderId !== folderId) {
      throw new ClipsError(
        'NOT_FOUND',
        '커서에 해당하는 클립을 찾을 수 없습니다.',
      );
    }

    if (type && cursorClip.type !== type) {
      throw new ClipsError(
        'NOT_FOUND',
        '커서에 해당하는 클립을 찾을 수 없습니다.',
      );
    }

    if (q && searchTarget) {
      const matches = await this.clipsRepository.isClipMatchingQuery({
        userId,
        folderId,
        workspaceId,
        type,
        q,
        searchTarget,
        likedOnly: undefined,
        clipId: cursor,
      });

      if (!matches) {
        throw new ClipsError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }
    }

    return this.clipsRepository.isClipLikedByUser(userId, cursor);
  }

  private async listWithLikedPriority({
    userId,
    folderId,
    workspaceId,
    cursor,
    cursorLiked,
    type,
    q,
    searchTarget,
  }: {
    userId: string;
    folderId: string;
    workspaceId: string;
    cursor: string | undefined;
    cursorLiked: boolean | null;
    type?: ClipType;
    q?: string;
    searchTarget?: ClipSearchTarget;
  }) {
    const baseParams = {
      userId,
      folderId,
      workspaceId,
      limit: LIST_CLIPS_LIMIT,
      type,
      q,
      searchTarget,
    };

    if (cursorLiked === false) {
      return buildPage(
        await this.clipsRepository.findClips({
          ...baseParams,
          cursor,
          likedOnly: false,
        }),
        LIST_CLIPS_LIMIT,
      );
    }

    const likedClips = await this.clipsRepository.findClips({
      ...baseParams,
      cursor: cursorLiked ? cursor : undefined,
      likedOnly: true,
    });
    const likedResult = buildPage(likedClips, LIST_CLIPS_LIMIT);

    if (likedResult.hasMore) {
      return {
        items: likedResult.items,
        nextCursor: likedResult.nextCursor,
      };
    }

    const remaining = LIST_CLIPS_LIMIT - likedResult.items.length;

    if (remaining > 0) {
      const nonLikedClips = await this.clipsRepository.findClips({
        ...baseParams,
        likedOnly: false,
        limit: remaining,
      });
      const combined = likedResult.items.concat(nonLikedClips);
      const combinedResult = buildPage(combined, LIST_CLIPS_LIMIT);

      return {
        items: combinedResult.items,
        nextCursor: combinedResult.nextCursor,
      };
    }

    const hasNonLiked =
      (
        await this.clipsRepository.findClips({
          ...baseParams,
          likedOnly: false,
          limit: 1,
        })
      ).length > 0;

    return {
      items: likedResult.items,
      nextCursor:
        hasNonLiked && likedResult.items.length > 0
          ? likedResult.items[likedResult.items.length - 1].id
          : null,
    };
  }
}
