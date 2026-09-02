import {
  ClipSearchTarget,
  ClipsRepository,
} from '../../domain/clips.repository';
import { ClipType } from '../../domain/clip.types';
import { ClipsError } from '../errors/clips.error';

type ResolveSearchTargetParams = {
  userId: string;
  type?: ClipType;
  q?: string;
  likedOnly?: true;
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
    ...(params.likedOnly ? { likedOnly: true } : {}),
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
  likedOnly?: true;
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
}: ValidateClipCursorParams): Promise<void> => {
  if (!cursor) {
    return;
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

  if (likedOnly) {
    const liked = await clipsRepository.isClipLikedByUser(userId, cursor);

    if (!liked) {
      throwCursorNotFound();
    }
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

function throwCursorNotFound(): never {
  throw new ClipsError('NOT_FOUND', '커서에 해당하는 클립을 찾을 수 없습니다.');
}
