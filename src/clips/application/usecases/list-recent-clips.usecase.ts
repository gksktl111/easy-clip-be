import {
  ClipSearchTarget,
  ClipTypeFilter,
  ClipsRepository,
} from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';
import {
  LIST_CLIPS_LIMIT,
  buildRecentPage,
  normalizeCursor,
  normalizeType,
} from './list-clips.common';

export type ListRecentClipsInput = {
  cursor: string;
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

    if (cursor) {
      const isValid = await this.clipsRepository.isRecentCursorMatchingQuery({
        userId,
        viewId: cursor,
        type,
        q: query,
        searchTarget: searchTarget ?? 'title',
      });

      if (!isValid) {
        throw new ClipsError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }
    }

    const recentClips = await this.clipsRepository.findRecentClips({
      userId,
      cursor,
      limit: LIST_CLIPS_LIMIT,
      type,
      q: query,
      searchTarget,
    });
    const page = buildRecentPage(recentClips, LIST_CLIPS_LIMIT);

    return {
      items: page.items.map((item) => {
        const { viewId, ...rest } = item;
        void viewId;
        return rest;
      }),
      nextCursor: page.nextCursor ? page.nextCursor : null,
    };
  }

  private async resolveSearchTarget({
    userId,
    type,
    q,
  }: {
    userId: string;
    type?: ClipTypeFilter;
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
}
