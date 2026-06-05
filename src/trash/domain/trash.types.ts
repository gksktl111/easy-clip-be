export type TrashFolderItem = {
  id: string;
  name: string;
  deletedAt: Date;
};

export type TrashClipItem = {
  id: string;
  title: string;
  type: 'TEXT' | 'COLOR' | 'IMAGE';
  folderId: string;
  deletedAt: Date;
};
