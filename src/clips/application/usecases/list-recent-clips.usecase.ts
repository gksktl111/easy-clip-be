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
import { normalizeCursor, normalizeType } from './list-clips.common';
import {
  listRecentClipsWithLikedPriority,
  resolveRecentClipSearchTarget,
} from './list-clips.helper';

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

    const cursorLiked = await this.resolveCursorLiked({
      userId,
      cursor,
      type,
      q: query,
      searchTarget,
    });

    return listRecentClipsWithLikedPriority({
      clipsRepository: this.clipsRepository,
      userId,
      cursor,
      cursorLiked,
      type,
      q: query,
      searchTarget,
    });
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
}
