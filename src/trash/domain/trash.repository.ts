import {
  DeleteTrashItemsParams,
  FindTrashItemsParams,
  RestoreTrashItemsParams,
  TrashClipItem,
  TrashFolderItem,
  TrashItem,
} from './trash.types';

export const TRASH_REPOSITORY = Symbol('TRASH_REPOSITORY');

export type HardDeleteTrashItemsResult = {
  deletedCount: number;
  imageUrls: string[];
};

export type HardDeleteSelectedTrashItemsResult = {
  clipsDeleted: number;
  foldersDeleted: number;
  totalDeleted: number;
  imageUrls: string[];
};

export type HardDeleteAllTrashItemsResult = {
  clipsDeleted: number;
  foldersDeleted: number;
  totalDeleted: number;
  imageUrls: string[];
};

export interface TrashRepository {
  findDeletedItems(params: FindTrashItemsParams): Promise<TrashItem[]>;
  findDeletedClipsByIds(
    userId: string,
    clipIds: string[],
  ): Promise<TrashClipItem[]>;
  findDeletedClipById(
    userId: string,
    clipId: string,
  ): Promise<TrashClipItem | null>;
  restoreItems(params: RestoreTrashItemsParams): Promise<void>;
  hardDeleteItems(
    params: DeleteTrashItemsParams,
  ): Promise<HardDeleteSelectedTrashItemsResult>;
  findDeletedFoldersByIds(
    userId: string,
    folderIds: string[],
  ): Promise<TrashFolderItem[]>;
  findDeletedFolderById(
    userId: string,
    folderId: string,
  ): Promise<TrashFolderItem | null>;
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
