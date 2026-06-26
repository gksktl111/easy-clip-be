import { TrashClipItem, TrashFolderItem } from './trash.types';

export const TRASH_REPOSITORY = Symbol('TRASH_REPOSITORY');

export type HardDeleteTrashItemsResult = {
  deletedCount: number;
  imageUrls: string[];
};

export interface TrashRepository {
  findDeletedClips(userId: string): Promise<TrashClipItem[]>;
  findDeletedClipById(
    userId: string,
    clipId: string,
  ): Promise<TrashClipItem | null>;
  restoreClip(clipId: string): Promise<TrashClipItem>;
  hardDeleteClip(clipId: string): Promise<HardDeleteTrashItemsResult>;
  findDeletedFolders(userId: string): Promise<TrashFolderItem[]>;
  findDeletedFolderById(
    userId: string,
    folderId: string,
  ): Promise<TrashFolderItem | null>;
  restoreFolderWithClips(folderId: string): Promise<TrashFolderItem>;
  hardDeleteFolderWithClips(
    folderId: string,
  ): Promise<HardDeleteTrashItemsResult>;
  hardDeleteExpiredFoldersWithClips(
    expiresBefore: Date,
    limit: number,
  ): Promise<HardDeleteTrashItemsResult>;
  hardDeleteExpiredClips(
    expiresBefore: Date,
    limit: number,
  ): Promise<HardDeleteTrashItemsResult>;
}
