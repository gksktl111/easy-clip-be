import {
  Clip,
  ClipListItem,
  ClipType,
  PersonalFolder,
  RecentClipItem,
  Tag,
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

export type UpdateClipParams = CreateClipParams & {
  clearTags?: boolean;
};

export type ReplaceClipTagsParams = {
  clipId: string;
  folderId: string;
  tagNames: string[];
};

export type FindClipsParams = {
  userId: string;
  folderId?: string;
  workspaceId?: string;
  cursor?: string;
  limit: number;
  type?: ClipType;
  q?: string;
  searchTarget?: ClipSearchTarget;
  likedOnly?: true;
};

export type FindRecentClipsParams = {
  userId: string;
  cursor?: string;
  limit: number;
  type?: ClipType;
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
  findRecentViewedClipIds(userId: string, limit: number): Promise<string[]>;
  findClipsByIdsForUser(
    userId: string,
    clipIds: string[],
  ): Promise<ClipListItem[]>;
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
  createClipView(userId: string, clipId: string): Promise<void>;
  isClipLikedByUser(userId: string, clipId: string): Promise<boolean>;
  createClipLike(userId: string, clipId: string): Promise<void>;
  deleteClipLike(userId: string, clipId: string): Promise<void>;
  createClip(params: CreateClipParams): Promise<Clip>;
  updateClip(clipId: string, params: UpdateClipParams): Promise<Clip>;
  replaceClipTags(params: ReplaceClipTagsParams): Promise<Tag[]>;
  softDeleteClip(clipId: string): Promise<Clip>;
  softDeleteClips(clipIds: string[]): Promise<number>;
  softDeleteAllClipsInFolder(userId: string, folderId: string): Promise<number>;
}
