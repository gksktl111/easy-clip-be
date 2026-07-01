export type TrashItemType = 'CLIP' | 'FOLDER';

export type TrashFolderItem = {
  id: string;
  name: string;
  deletedAt: Date | null;
};

export type TrashClipItem = {
  id: string;
  title: string;
  type: 'TEXT' | 'COLOR' | 'IMAGE';
  folderId: string;
  deletedAt: Date | null;
  folderDeletedAt?: Date | null;
};

export type TrashListFolderItem = TrashFolderItem & {
  itemType: 'FOLDER';
};

export type TrashListClipItem = TrashClipItem & {
  itemType: 'CLIP';
};

export type TrashItem = TrashListClipItem | TrashListFolderItem;

export type RestoreTrashItem = {
  itemType: TrashItemType;
  id: string;
};

export type RestoreTrashItemsParams = {
  userId: string;
  clipIds: string[];
  folderIds: string[];
};

export type DeleteTrashItemsParams = {
  userId: string;
  clipIds: string[];
  folderIds: string[];
};

export type TrashCursorPage<T> = {
  items: T[];
  hasNextPage: boolean;
  nextCursor: string | null;
};

export type FindTrashItemsParams = {
  userId: string;
  cursor?: string;
  limit: number;
};
