import {
  ClipSearchTarget,
  ClipTypeFilter,
  ClipsRepository,
} from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';
import {
  LIST_CLIPS_LIMIT,
  buildPage,
  normalizeCursor,
  normalizeType,
} from './list-clips.common';

export type ListFavoriteClipsInput = {
  cursor: string;
  type: ClipTypeFilter;
  q?: string;
};

export class ListFavoriteClipsUseCase {
  constructor(private readonly clipsRepository: ClipsRepository) {}

  async execute(userId: string, input: ListFavoriteClipsInput) {
    const cursor = normalizeCursor(input.cursor);
    const type = normalizeType(input.type);
    const query = input.q?.trim();

    const searchTarget = await this.resolveSearchTarget({
      userId,
      type,
      q: query,
      likedOnly: true,
    });

    if (cursor) {
      await this.validateCursor({
        userId,
        cursor,
        type,
        q: query,
        searchTarget,
      });
    }

    return buildPage(
      await this.clipsRepository.findClips({
        userId,
        cursor,
        limit: LIST_CLIPS_LIMIT,
        type,
        q: query,
        searchTarget,
        likedOnly: true,
      }),
      LIST_CLIPS_LIMIT,
    );
  }

  private async resolveSearchTarget({
    userId,
    type,
    q,
    likedOnly,
  }: {
    userId: string;
    type?: ClipTypeFilter;
    q?: string;
    likedOnly?: boolean;
  }): Promise<ClipSearchTarget | undefined> {
    if (!q) {
      return undefined;
    }

    const hasTitleMatches = await this.clipsRepository.hasTitleMatches({
      userId,
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
    type,
    q,
    searchTarget,
  }: {
    userId: string;
    cursor: string;
    type?: ClipTypeFilter;
    q?: string;
    searchTarget?: ClipSearchTarget;
  }) {
    const cursorClip = await this.clipsRepository.findClipByIdForUser(
      userId,
      cursor,
    );

    if (!cursorClip) {
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

    const liked = await this.clipsRepository.isClipLikedByUser(userId, cursor);

    if (!liked) {
      throw new ClipsError(
        'NOT_FOUND',
        '커서에 해당하는 클립을 찾을 수 없습니다.',
      );
    }

    if (q && searchTarget) {
      const matches = await this.clipsRepository.isClipMatchingQuery({
        userId,
        type,
        q,
        searchTarget,
        likedOnly: true,
        clipId: cursor,
      });

      if (!matches) {
        throw new ClipsError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }
    }
  }
}
