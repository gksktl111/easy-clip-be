import { Folder } from './folder.types';
import { FolderTag } from './folder-tag.types';

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

export type CreateFolderTagParams = {
  folderId: string;
  name: string;
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
  findTagsByFolderId(folderId: string): Promise<FolderTag[]>;
  findTagByIdInFolder(
    folderId: string,
    tagId: string,
  ): Promise<FolderTag | null>;
  findTagByNameInFolder(
    folderId: string,
    name: string,
  ): Promise<FolderTag | null>;
  findLastFolderOrder(workspaceId: string): Promise<number | null>;
  createFolder(params: CreateFolderParams): Promise<Folder>;
  createFolderTag(params: CreateFolderTagParams): Promise<FolderTag>;
  updateFolderName(folderId: string, name: string): Promise<Folder>;
  updateFolderTagName(tagId: string, name: string): Promise<FolderTag>;
  updateFolderOrder(folderId: string, order: number): Promise<Folder>;
  deleteFolderTag(tagId: string): Promise<void>;
  softDeleteFolderWithClips(folderId: string): Promise<Folder>;
  findPreviousFolderOrder(params: FolderOrderParams): Promise<number | null>;
  findNextFolderOrder(params: FolderOrderParams): Promise<number | null>;
}
