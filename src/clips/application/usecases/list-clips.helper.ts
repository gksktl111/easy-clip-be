import {
  ClipSearchTarget,
  ClipsRepository,
} from '../../domain/clips.repository';
import {
  ClipListItem,
  ClipType,
  RecentClipItem,
} from '../../domain/clip.types';
import {
  LIST_CLIPS_LIMIT,
  buildPage,
  buildRecentPage,
} from './list-clips.common';
import { ClipsError } from '../errors/clips.error';

type ResolveSearchTargetParams = {
  userId: string;
  type?: ClipType;
  q?: string;
  likedOnly?: boolean;
  folderId?: string;
  workspaceId?: string;
};

export const resolveClipSearchTarget = async (
  clipsRepository: ClipsRepository,
  params: ResolveSearchTargetParams,
): Promise<ClipSearchTarget | undefined> => {
  if (!params.q) {
    return undefined;
  }

  const hasTitleMatches = await clipsRepository.hasTitleMatches({
    userId: params.userId,
    folderId: params.folderId,
    workspaceId: params.workspaceId,
    type: params.type,
    q: params.q,
    searchTarget: 'title',
    likedOnly: params.likedOnly,
  });

  return hasTitleMatches ? 'title' : 'tag';
};

type ValidateClipCursorParams = {
  clipsRepository: ClipsRepository;
  userId: string;
  cursor: string | undefined;
  type?: ClipType;
  q?: string;
  searchTarget?: ClipSearchTarget;
  folderId?: string;
  workspaceId?: string;
  likedOnly?: boolean;
};

export const validateClipCursor = async ({
  clipsRepository,
  userId,
  cursor,
  type,
  q,
  searchTarget,
  folderId,
  workspaceId,
  likedOnly,
}: ValidateClipCursorParams): Promise<boolean | null> => {
  if (!cursor) {
    return null;
  }

  const cursorClip = await clipsRepository.findClipByIdForUser(userId, cursor);

  if (!cursorClip) {
    throwCursorNotFound();
  }

  if (folderId && cursorClip.folderId !== folderId) {
    throwCursorNotFound();
  }

  if (type && cursorClip.type !== type) {
    throwCursorNotFound();
  }

  const liked = await clipsRepository.isClipLikedByUser(userId, cursor);

  if (likedOnly === true && !liked) {
    throwCursorNotFound();
  }

  if (q && searchTarget) {
    const matches = await clipsRepository.isClipMatchingQuery({
      userId,
      folderId,
      workspaceId,
      type,
      q,
      searchTarget,
      likedOnly,
      clipId: cursor,
    });

    if (!matches) {
      throwCursorNotFound();
    }
  }

  return liked;
};

export const resolveRecentClipSearchTarget = async (
  clipsRepository: ClipsRepository,
  params: Omit<
    ResolveSearchTargetParams,
    'folderId' | 'workspaceId' | 'likedOnly'
  >,
): Promise<ClipSearchTarget | undefined> => {
  if (!params.q) {
    return undefined;
  }

  const hasTitleMatches = await clipsRepository.hasRecentTitleMatches({
    userId: params.userId,
    type: params.type,
    q: params.q,
    searchTarget: 'title',
  });

  return hasTitleMatches ? 'title' : 'tag';
};

type ListClipsWithLikedPriorityParams = {
  clipsRepository: ClipsRepository;
  userId: string;
  cursor: string | undefined;
  cursorLiked: boolean | null;
  type?: ClipType;
  q?: string;
  searchTarget?: ClipSearchTarget;
  folderId?: string;
  workspaceId?: string;
};

export const listClipsWithLikedPriority = async ({
  clipsRepository,
  userId,
  cursor,
  cursorLiked,
  type,
  q,
  searchTarget,
  folderId,
  workspaceId,
}: ListClipsWithLikedPriorityParams) => {
  const baseParams = {
    userId,
    folderId,
    workspaceId,
    limit: LIST_CLIPS_LIMIT,
    type,
    q,
    searchTarget,
  };

  if (cursorLiked === false) {
    return buildPage(
      await clipsRepository.findClips({
        ...baseParams,
        cursor,
        likedOnly: false,
      }),
      LIST_CLIPS_LIMIT,
    );
  }

  const likedClips = await clipsRepository.findClips({
    ...baseParams,
    cursor: cursorLiked ? cursor : undefined,
    likedOnly: true,
  });
  const likedResult = buildPage(likedClips, LIST_CLIPS_LIMIT);

  if (likedResult.hasMore) {
    return {
      items: likedResult.items,
      hasMore: true,
      nextCursor: likedResult.nextCursor,
    };
  }

  const remaining = LIST_CLIPS_LIMIT - likedResult.items.length;

  if (remaining > 0) {
    const nonLikedClips = await clipsRepository.findClips({
      ...baseParams,
      likedOnly: false,
      limit: remaining,
    });
    const combined = likedResult.items.concat(nonLikedClips);
    const combinedResult = buildPage(combined, LIST_CLIPS_LIMIT);

    return {
      items: combinedResult.items,
      hasMore: combinedResult.hasMore,
      nextCursor: combinedResult.nextCursor,
    };
  }

  const hasNonLiked =
    (
      await clipsRepository.findClips({
        ...baseParams,
        likedOnly: false,
        limit: 1,
      })
    ).length > 0;

  return {
    items: likedResult.items,
    hasMore: hasNonLiked,
    nextCursor:
      hasNonLiked && likedResult.items.length > 0
        ? likedResult.items[likedResult.items.length - 1].id
        : null,
  };
};

type ListRecentClipsWithLikedPriorityParams = {
  clipsRepository: ClipsRepository;
  userId: string;
  cursor: string | undefined;
  cursorLiked: boolean | null;
  type?: ClipType;
  q?: string;
  searchTarget?: ClipSearchTarget;
};

export const listRecentClipsWithLikedPriority = async ({
  clipsRepository,
  userId,
  cursor,
  cursorLiked,
  type,
  q,
  searchTarget,
}: ListRecentClipsWithLikedPriorityParams) => {
  const baseParams = {
    userId,
    limit: LIST_CLIPS_LIMIT,
    type,
    q,
    searchTarget,
  };

  if (cursorLiked === false) {
    const page = buildRecentPage(
      await clipsRepository.findRecentClips({
        ...baseParams,
        cursor,
        likedOnly: false,
      }),
      LIST_CLIPS_LIMIT,
    );

    return {
      items: stripRecentViewId(page.items),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    };
  }

  const likedClips = await clipsRepository.findRecentClips({
    ...baseParams,
    cursor: cursorLiked ? cursor : undefined,
    likedOnly: true,
  });
  const likedResult = buildRecentPage(likedClips, LIST_CLIPS_LIMIT);

  if (likedResult.hasMore) {
    return {
      items: stripRecentViewId(likedResult.items),
      hasMore: true,
      nextCursor: likedResult.nextCursor,
    };
  }

  const remaining = LIST_CLIPS_LIMIT - likedResult.items.length;

  if (remaining > 0) {
    const nonLikedClips = await clipsRepository.findRecentClips({
      ...baseParams,
      likedOnly: false,
      limit: remaining,
    });
    const combined = likedResult.items.concat(nonLikedClips);
    const combinedResult = buildRecentPage(combined, LIST_CLIPS_LIMIT);

    return {
      items: stripRecentViewId(combinedResult.items),
      hasMore: combinedResult.hasMore,
      nextCursor: combinedResult.nextCursor,
    };
  }

  const hasNonLiked =
    (
      await clipsRepository.findRecentClips({
        ...baseParams,
        likedOnly: false,
        limit: 1,
      })
    ).length > 0;

  return {
    items: stripRecentViewId(likedResult.items),
    hasMore: hasNonLiked,
    nextCursor:
      hasNonLiked && likedResult.items.length > 0
        ? likedResult.items[likedResult.items.length - 1].viewId
        : null,
  };
};

const stripRecentViewId = (items: RecentClipItem[]): ClipListItem[] => {
  return items.map((item) => {
    const { viewId, ...rest } = item;
    void viewId;
    return rest;
  });
};

function throwCursorNotFound(): never {
  throw new ClipsError('NOT_FOUND', '커서에 해당하는 클립을 찾을 수 없습니다.');
}
