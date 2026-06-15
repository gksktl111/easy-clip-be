import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { FavoriteClipsPageOutput } from '../dtos/clip-cursor-page-output.dto';
import { ListFavoriteClipsInput } from '../dtos/list-favorite-clips-input.dto';
import {
  LIST_CLIPS_LIMIT,
  buildPage,
  normalizeCursor,
  normalizeType,
} from './list-clips.common';
import {
  resolveClipSearchTarget,
  validateClipCursor,
} from './list-clips.helper';

@Injectable()
export class ListFavoriteClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(
    userId: string,
    input: ListFavoriteClipsInput,
  ): Promise<FavoriteClipsPageOutput> {
    const cursor = normalizeCursor(input.cursor);
    const type = normalizeType(input.type);
    const query = input.q?.trim();

    const searchTarget = await resolveClipSearchTarget(this.clipsRepository, {
      userId,
      type,
      q: query,
      likedOnly: true,
    });

    if (cursor) {
      await validateClipCursor({
        clipsRepository: this.clipsRepository,
        userId,
        cursor,
        type,
        q: query,
        searchTarget,
        likedOnly: true,
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
}
