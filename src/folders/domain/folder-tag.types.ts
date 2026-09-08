import type { TagBackgroundColor } from 'src/shared/application/tag-background-color.helper';

export type FolderTag = {
  id: string;
  name: string;
  backgroundColor: TagBackgroundColor;
  folderId: string;
};
