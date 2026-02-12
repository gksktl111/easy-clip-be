import { ClipListItem } from '../../domain/clip.types';
import { ClipsRepository } from '../../domain/clips.repository';

export const RECENT_VIEWED_CLIPS_LIMIT = 50;

export class ListRecentViewedClipsUseCase {
  constructor(private readonly clipsRepository: ClipsRepository) {}

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
      recentViews.map((view) => view.clipId),
    );

    const clipById = new Map(clips.map((clip) => [clip.id, clip]));
    const orderedClips = recentViews.flatMap((view) => {
      const clip = clipById.get(view.clipId);
      return clip ? [clip] : [];
    });

    return {
      items: orderedClips,
    };
  }
}
