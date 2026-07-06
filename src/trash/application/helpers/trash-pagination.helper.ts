import { TrashCursorPage } from '../../domain/trash.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export type ListTrashItemsInput = {
  cursor?: string;
  limit?: number;
};

export function normalizeLimit(limit?: number): number {
  if (!Number.isInteger(limit) || limit === undefined) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

export function toCursorPage<T extends { id: string }>(
  items: T[],
  limit: number,
  getCursor: (item: T) => string = (item) => item.id,
): TrashCursorPage<T> {
  const hasNextPage = items.length > limit;
  const pageItems = hasNextPage ? items.slice(0, limit) : items;

  return {
    items: pageItems,
    hasNextPage,
    nextCursor: hasNextPage
      ? pageItems[pageItems.length - 1]
        ? getCursor(pageItems[pageItems.length - 1])
        : null
      : null,
  };
}
