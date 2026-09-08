import type { TagBackgroundColor } from 'src/shared/application/tag-background-color.helper';

export type UpdateFolderTagInput = {
  folderId: string;
  tagId: string;
  name?: string;
  backgroundColor?: TagBackgroundColor;
};
