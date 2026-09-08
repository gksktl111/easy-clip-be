import { Inject, Injectable } from '@nestjs/common';
import {
  CLIPS_REPOSITORY,
  ClipSearchTarget,
} from '../../domain/clips.repository';
import { ClipType } from '../../domain/clip.types';
import type { ClipsRepository } from '../../domain/clips.repository';
import { ClipCursorPageOutput } from '../dtos/clip-cursor-page-output.dto';
import { ListRecentClipsInput } from '../dtos/list-recent-clips-input.dto';
import { ClipsError } from '../errors/clips.error';
import {
  LIST_CLIPS_LIMIT,
  buildRecentPage,
  normalizeCursor,
  normalizeType,
} from './list-clips.common';
import { resolveRecentClipSearchTarget } from './list-clips.helper';

@Injectable()
export class ListRecentClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(
    userId: string,
    input: ListRecentClipsInput,
  ): Promise<ClipCursorPageOutput> {
    const cursor = normalizeCursor(input.cursor);
    const type = normalizeType(input.type);
    const query = input.q?.trim();

    const searchTarget = await resolveRecentClipSearchTarget(
      this.clipsRepository,
      {
        userId,
        type,
        q: query,
      },
    );

    await this.assertCursorMatches({
      userId,
      cursor,
      type,
      q: query,
      searchTarget,
    });

    const page = buildRecentPage(
      await this.clipsRepository.findRecentClips({
        userId,
        cursor,
        limit: LIST_CLIPS_LIMIT,
        type,
        q: query,
        searchTarget,
      }),
      LIST_CLIPS_LIMIT,
    );

    return {
      items: page.items.map(({ viewId, ...clip }) => {
        void viewId;
        return clip;
      }),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    };
  }

  private async assertCursorMatches({
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
  }): Promise<void> {
    if (!cursor) {
      return;
    }

    const cursorMatches =
      await this.clipsRepository.isRecentCursorMatchingQuery({
        userId,
        viewId: cursor,
        type,
        q,
        searchTarget: searchTarget ?? 'title',
      });

    if (!cursorMatches) {
      throw new ClipsError(
        'NOT_FOUND',
        '커서에 해당하는 클립을 찾을 수 없습니다.',
      );
    }
  }
}
