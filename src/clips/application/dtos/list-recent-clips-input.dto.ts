import type { ClipTypeFilter } from '../../domain/clips.repository';

export type ListRecentClipsInput = {
  cursor?: string;
  type: ClipTypeFilter;
  q?: string;
};
