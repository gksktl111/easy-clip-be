import {
  Clip,
  ClipListItem,
  ClipType,
  PersonalFolder,
  RecentClipItem,
} from './clip.types';

export const CLIPS_REPOSITORY = Symbol('CLIPS_REPOSITORY');

export type ClipTypeFilter = ClipType | 'ALL';
export type ClipSearchTarget = 'title' | 'tag';

export type CreateClipParams = {
  type: ClipType;
  title: string;
  folderId: string;
  workspaceId: string;
  textContent: string | null;
  colorHex: string | null;
  imageUrl: string | null;
};

export type UpdateClipParams = CreateClipParams;

export type FindClipsParams = {
  userId: string;
  folderId?: string;
  workspaceId?: string;
  cursor?: string;
  limit: number;
  type?: ClipTypeFilter;
  q?: string;
  searchTarget?: ClipSearchTarget;
  likedOnly?: boolean;
};

export type FindRecentClipsParams = {
  userId: string;
  cursor?: string;
  limit: number;
  type?: ClipTypeFilter;
  q?: string;
  searchTarget?: ClipSearchTarget;
};

export interface ClipsRepository {
  findPersonalFolderById(
    userId: string,
    folderId: string,
  ): Promise<PersonalFolder | null>;
  findClipByIdForUser(userId: string, clipId: string): Promise<Clip | null>;
  findClips(params: FindClipsParams): Promise<ClipListItem[]>;
  findRecentClips(params: FindRecentClipsParams): Promise<RecentClipItem[]>;
  hasTitleMatches(
    params: Omit<FindClipsParams, 'cursor' | 'limit'> & {
      q: string;
    },
  ): Promise<boolean>;
  hasRecentTitleMatches(
    params: Omit<FindRecentClipsParams, 'cursor' | 'limit'> & { q: string },
  ): Promise<boolean>;
  isClipMatchingQuery(
    params: Omit<FindClipsParams, 'cursor' | 'limit'> & {
      clipId: string;
      searchTarget: ClipSearchTarget;
    },
  ): Promise<boolean>;
  isRecentCursorMatchingQuery(
    params: Omit<FindRecentClipsParams, 'cursor' | 'limit'> & {
      viewId: string;
      searchTarget: ClipSearchTarget;
    },
  ): Promise<boolean>;
  isClipLikedByUser(userId: string, clipId: string): Promise<boolean>;
  createClip(params: CreateClipParams): Promise<Clip>;
  updateClip(clipId: string, params: UpdateClipParams): Promise<Clip>;
  softDeleteClip(clipId: string): Promise<Clip>;
}
