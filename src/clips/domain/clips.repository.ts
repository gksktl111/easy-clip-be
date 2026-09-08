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

export type UpdateClipParams = Omit<
  CreateClipParams,
  'folderId' | 'workspaceId'
>;

export type UpdatedClip = {
  clip: Clip;
  previousImageUrl: string | null;
};

export type ReplaceClipTagsParams = {
  userId: string;
  clipId: string;
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
  createClip(userId: string, params: CreateClipParams): Promise<Clip>;
  updateClip(
    userId: string,
    clipId: string,
    params: UpdateClipParams,
  ): Promise<UpdatedClip | null>;
  isCreatedImageReferenced(userId: string, imageUrl: string): Promise<boolean>;
  isClipImageReferenced(clipId: string, imageUrl: string): Promise<boolean>;
  replaceClipTags(params: ReplaceClipTagsParams): Promise<Tag[]>;
  softDeleteClip(userId: string, clipId: string): Promise<Clip>;
  softDeleteClips(userId: string, clipIds: string[]): Promise<number>;
  softDeleteAllClipsInFolder(userId: string, folderId: string): Promise<number>;
}
