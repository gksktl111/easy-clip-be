import type { TagBackgroundColor } from 'src/shared/application/tag-background-color.helper';

export type CreateFolderTagInput = {
  folderId: string;
  name: string;
  backgroundColor?: TagBackgroundColor;
};
