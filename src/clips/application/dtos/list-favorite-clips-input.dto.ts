import type { ClipTypeFilter } from '../../domain/clips.repository';

export type ListFavoriteClipsInput = {
  cursor?: string;
  type: ClipTypeFilter;
  q?: string;
};
