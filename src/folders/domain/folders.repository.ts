import { Folder } from './folder.types';

export const FOLDERS_REPOSITORY = Symbol('FOLDERS_REPOSITORY');

export type FolderOrderParams = {
  workspaceId: string;
  referenceOrder: number;
  excludeId: string;
};

export type CreateFolderParams = {
  workspaceId: string;
  name: string;
  order: number;
};

export interface FoldersRepository {
  findPersonalWorkspaceId(userId: string): Promise<string | null>;
  getOrCreatePersonalWorkspaceId(userId: string): Promise<string>;
  findFoldersByWorkspaceId(workspaceId: string): Promise<Folder[]>;
  findPersonalFolderById(
    userId: string,
    folderId: string,
  ): Promise<Folder | null>;
  findFolderById(folderId: string): Promise<Folder | null>;
  findFolderByIdInWorkspace(
    folderId: string,
    workspaceId: string,
  ): Promise<Folder | null>;
  findLastFolderOrder(workspaceId: string): Promise<number | null>;
  createFolder(params: CreateFolderParams): Promise<Folder>;
  updateFolderName(folderId: string, name: string): Promise<Folder>;
  updateFolderOrder(folderId: string, order: number): Promise<Folder>;
  softDeleteFolder(folderId: string): Promise<Folder>;
  findPreviousFolderOrder(params: FolderOrderParams): Promise<number | null>;
  findNextFolderOrder(params: FolderOrderParams): Promise<number | null>;
}
