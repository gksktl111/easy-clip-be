export class ReorderFolderDto {
  folderId: string;
  targetFolderId: string | null;
  position: 'before' | 'after';
}
