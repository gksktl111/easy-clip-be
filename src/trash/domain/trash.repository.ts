import {
  FindTrashItemsParams,
  TrashClipItem,
  TrashFolderItem,
} from './trash.types';

export const TRASH_REPOSITORY = Symbol('TRASH_REPOSITORY');

export type HardDeleteTrashItemsResult = {
  deletedCount: number;
  imageUrls: string[];
};

export type HardDeleteAllTrashItemsResult = {
  clipsDeleted: number;
  foldersDeleted: number;
  totalDeleted: number;
  imageUrls: string[];
};

export interface TrashRepository {
  findDeletedClips(params: FindTrashItemsParams): Promise<TrashClipItem[]>;
  findDeletedClipById(
    userId: string,
    clipId: string,
  ): Promise<TrashClipItem | null>;
  restoreClip(clipId: string): Promise<TrashClipItem>;
  hardDeleteClip(clipId: string): Promise<HardDeleteTrashItemsResult>;
  findDeletedFolders(params: FindTrashItemsParams): Promise<TrashFolderItem[]>;
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
  hardDeleteAllTrashItemsForUser(
    userId: string,
  ): Promise<HardDeleteAllTrashItemsResult>;
}
