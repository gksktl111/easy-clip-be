import {
  ClipSearchTarget,
  ClipTypeFilter,
  ClipsRepository,
} from '../../domain/clips.repository';
import { ClipType, RecentClipItem } from '../../domain/clip.types';
import { ClipsError } from '../clips.error';
import {
  LIST_CLIPS_LIMIT,
  buildRecentPage,
  normalizeCursor,
  normalizeType,
} from './list-clips.common';

export type ListRecentClipsInput = {
  cursor?: string;
  type: ClipTypeFilter;
  q?: string;
};

export class ListRecentClipsUseCase {
  constructor(private readonly clipsRepository: ClipsRepository) {}

  async execute(userId: string, input: ListRecentClipsInput) {
    const cursor = normalizeCursor(input.cursor);
    const type = normalizeType(input.type);
    const query = input.q?.trim();

    const searchTarget = await this.resolveSearchTarget({
      userId,
      type,
      q: query,
    });

    const cursorLiked = await this.resolveCursorLiked({
      userId,
      cursor,
      type,
      q: query,
      searchTarget,
    });

    return this.listWithLikedPriority({
      userId,
      cursor,
      cursorLiked,
      type,
      q: query,
      searchTarget,
    });
  }

  private async resolveSearchTarget({
    userId,
    type,
    q,
  }: {
    userId: string;
    type?: ClipType;
    q?: string;
  }): Promise<ClipSearchTarget | undefined> {
    if (!q) {
      return undefined;
    }

    const hasTitleMatches = await this.clipsRepository.hasRecentTitleMatches({
      userId,
      type,
      q,
      searchTarget: 'title',
    });

    return hasTitleMatches ? 'title' : 'tag';
  }

  private async resolveCursorLiked({
    userId,
    cursor,
    type,
    q,
    searchTarget,
  }: {
    userId: string;
    cursor: string | undefined;
    type?: ClipType;
    q?: string;
    searchTarget?: ClipSearchTarget;
  }): Promise<boolean | null> {
    if (!cursor) {
      return null;
    }

    const cursorMeta = await this.clipsRepository.isRecentCursorMatchingQuery({
      userId,
      viewId: cursor,
      type,
      q,
      searchTarget: searchTarget ?? 'title',
    });

    if (!cursorMeta) {
      throw new ClipsError(
        'NOT_FOUND',
        '커서에 해당하는 클립을 찾을 수 없습니다.',
      );
    }

    return cursorMeta.liked;
  }

  private async listWithLikedPriority({
    userId,
    cursor,
    cursorLiked,
    type,
    q,
    searchTarget,
  }: {
    userId: string;
    cursor: string | undefined;
    cursorLiked: boolean | null;
    type?: ClipType;
    q?: string;
    searchTarget?: ClipSearchTarget;
  }) {
    const baseParams = {
      userId,
      limit: LIST_CLIPS_LIMIT,
      type,
      q,
      searchTarget,
    };

    if (cursorLiked === false) {
      const page = buildRecentPage(
        await this.clipsRepository.findRecentClips({
          ...baseParams,
          cursor,
          likedOnly: false,
        }),
        LIST_CLIPS_LIMIT,
      );

      return {
        items: this.stripViewId(page.items),
        nextCursor: page.nextCursor,
      };
    }

    const likedClips = await this.clipsRepository.findRecentClips({
      ...baseParams,
      cursor: cursorLiked ? cursor : undefined,
      likedOnly: true,
    });
    const likedResult = buildRecentPage(likedClips, LIST_CLIPS_LIMIT);

    if (likedResult.hasMore) {
      return {
        items: this.stripViewId(likedResult.items),
        nextCursor: likedResult.nextCursor,
      };
    }

    const remaining = LIST_CLIPS_LIMIT - likedResult.items.length;

    if (remaining > 0) {
      const nonLikedClips = await this.clipsRepository.findRecentClips({
        ...baseParams,
        likedOnly: false,
        limit: remaining,
      });
      const combined = likedResult.items.concat(nonLikedClips);
      const combinedResult = buildRecentPage(combined, LIST_CLIPS_LIMIT);

      return {
        items: this.stripViewId(combinedResult.items),
        nextCursor: combinedResult.nextCursor,
      };
    }

    const hasNonLiked =
      (
        await this.clipsRepository.findRecentClips({
          ...baseParams,
          likedOnly: false,
          limit: 1,
        })
      ).length > 0;

    return {
      items: this.stripViewId(likedResult.items),
      nextCursor:
        hasNonLiked && likedResult.items.length > 0
          ? likedResult.items[likedResult.items.length - 1].viewId
          : null,
    };
  }

  private stripViewId(items: RecentClipItem[]) {
    return items.map((item) => {
      const { viewId, ...rest } = item;
      void viewId;
      return rest;
    });
  }
}
