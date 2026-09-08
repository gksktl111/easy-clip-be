export type FolderOutput = {
  isLocked?: boolean;
  id: string;
  name: string;
  order: number;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
