import { TrashClipItem, TrashFolderItem } from './trash.types';

export const TRASH_REPOSITORY = Symbol('TRASH_REPOSITORY');

export interface TrashRepository {
  findDeletedClips(userId: string): Promise<TrashClipItem[]>;
  findDeletedClipById(
    userId: string,
    clipId: string,
  ): Promise<TrashClipItem | null>;
  restoreClip(clipId: string): Promise<TrashClipItem>;
  hardDeleteClip(clipId: string): Promise<void>;
  findDeletedFolders(userId: string): Promise<TrashFolderItem[]>;
  findDeletedFolderById(
    userId: string,
    folderId: string,
  ): Promise<TrashFolderItem | null>;
  restoreFolderWithClips(folderId: string): Promise<TrashFolderItem>;
  hardDeleteFolderWithClips(folderId: string): Promise<void>;
  hardDeleteExpiredFoldersWithClips(
    expiresBefore: Date,
    limit: number,
  ): Promise<number>;
  hardDeleteExpiredClips(expiresBefore: Date, limit: number): Promise<number>;
}
