export type ClipType = 'TEXT' | 'COLOR' | 'IMAGE';

export type Clip = {
  id: string;
  type: ClipType;
  title: string;
  textContent: string | null;
  colorHex: string | null;
  imageUrl: string | null;
  workspaceId: string;
  folderId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type Tag = {
  id: string;
  name: string;
};

export type ClipListItem = Clip & {
  likedByMe: boolean;
  tags: Tag[];
};

export type PersonalFolder = {
  id: string;
  workspaceId: string;
};
