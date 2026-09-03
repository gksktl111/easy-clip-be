import type { TagBackgroundColor } from 'src/shared/application/tag-background-color.helper';

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
  backgroundColor: TagBackgroundColor;
};

export type ClipListItem = Clip & {
  likeByMe: boolean;
  tags: Tag[];
};

export type RecentClipItem = ClipListItem & {
  viewId: string;
};

export type ClipDetail = Clip & {
  likeByMe: boolean;
};

export type PersonalFolder = {
  id: string;
  workspaceId: string;
};
