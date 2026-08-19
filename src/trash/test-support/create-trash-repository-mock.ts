import type { TrashRepository } from '../domain/trash.repository';

export const createTrashRepositoryMock = (): jest.Mocked<TrashRepository> => ({
  findDeletedItems: jest.fn(),
  findDeletedClipsByIds: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreItems: jest.fn(),
  hardDeleteItems: jest.fn(),
  findDeletedFoldersByIds: jest.fn(),
  findDeletedFolderById: jest.fn(),
  hardDeleteExpiredFoldersWithClips: jest.fn(),
  hardDeleteExpiredClips: jest.fn(),
  hardDeleteAllTrashItemsForUser: jest.fn(),
});
