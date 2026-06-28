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
