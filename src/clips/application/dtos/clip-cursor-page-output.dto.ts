import type { ClipListItem } from '../../domain/clip.types';

export type ClipCursorPageOutput = {
  items: ClipListItem[];
  nextCursor: string | null;
};

export type FavoriteClipsPageOutput = {
  items: ClipListItem[];
  hasMore: boolean;
  nextCursor: string | null;
};
