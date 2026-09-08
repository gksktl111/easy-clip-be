import type { FoldersRepository } from '../domain/folders.repository';

export const createFoldersRepositoryMock =
  (): jest.Mocked<FoldersRepository> => ({
    findPersonalWorkspaceId: jest.fn(),
    getOrCreatePersonalWorkspaceId: jest.fn(),
    findFoldersByWorkspaceId: jest.fn(),
    findPersonalFolderById: jest.fn(),
    findFolderById: jest.fn(),
    findFolderByIdInWorkspace: jest.fn(),
    findTagsByFolderId: jest.fn(),
    findTagByIdInFolder: jest.fn(),
    findTagByNameInFolder: jest.fn(),
    findLastFolderOrder: jest.fn(),
    createFolder: jest.fn(),
    createFolderTag: jest.fn(),
    updateFolderName: jest.fn(),
    updateFolderTag: jest.fn(),
    updateFolderOrder: jest.fn(),
    deleteFolderTag: jest.fn(),
    softDeleteFolder: jest.fn(),
    findPreviousFolderOrder: jest.fn(),
    findNextFolderOrder: jest.fn(),
  });
