import { Inject, Injectable } from '@nestjs/common';
import { ClipListItem } from '../../domain/clip.types';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';

export const RECENT_VIEWED_CLIPS_LIMIT = 50;

@Injectable()
export class ListRecentViewedClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(userId: string): Promise<{ items: ClipListItem[] }> {
    const recentViews = await this.clipsRepository.findRecentViewedClipIds(
      userId,
      RECENT_VIEWED_CLIPS_LIMIT,
    );

    if (recentViews.length === 0) {
      return { items: [] };
    }

    const clips = await this.clipsRepository.findClipsByIdsForUser(
      userId,
      recentViews,
    );

    const clipById = new Map(clips.map((clip) => [clip.id, clip]));
    const orderedClips = recentViews.flatMap((clipId) => {
      const clip = clipById.get(clipId);
      return clip ? [clip] : [];
    });

    return {
      items: orderedClips,
    };
  }
}
