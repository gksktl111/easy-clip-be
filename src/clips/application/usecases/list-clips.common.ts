import { ClipTypeFilter } from '../../domain/clips.repository';

export const LIST_CLIPS_LIMIT = 20;

export const normalizeCursor = (raw?: string) => {
  const trimmed = raw?.trim();

  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return undefined;
  }

  return trimmed;
};

export const normalizeType = (type?: ClipTypeFilter) => {
  if (!type || type === 'ALL') {
    return undefined;
  }

  return type;
};

export const buildPage = <T extends { id: string }>(
  items: T[],
  limit: number,
) => {
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;

  return {
    items: sliced,
    hasMore,
    nextCursor:
      hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null,
  };
};

export const buildRecentPage = <T extends { viewId: string }>(
  items: T[],
  limit: number,
) => {
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;

  return {
    items: sliced,
    hasMore,
    nextCursor:
      hasMore && sliced.length > 0 ? sliced[sliced.length - 1].viewId : null,
  };
};
