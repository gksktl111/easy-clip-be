import type { ClipTypeFilter } from '../../domain/clips.repository';

export type ListFolderClipsInput = {
  folderId: string;
  cursor?: string;
  type: ClipTypeFilter;
  q?: string;
};
