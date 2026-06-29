/* eslint-disable @typescript-eslint/unbound-method */
import { ListTrashFoldersUseCase } from './list-trash-folders.usecase';
import { TrashRepository } from '../../domain/trash.repository';

const createRepository = (): jest.Mocked<TrashRepository> => ({
  findDeletedClips: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreClip: jest.fn(),
  hardDeleteClip: jest.fn(),
  findDeletedFolders: jest.fn(),
  findDeletedFolderById: jest.fn(),
  restoreFolderWithClips: jest.fn(),
  hardDeleteFolderWithClips: jest.fn(),
  hardDeleteExpiredFoldersWithClips: jest.fn(),
  hardDeleteExpiredClips: jest.fn(),
});

describe('ListTrashFoldersUseCase', () => {
  it('휴지통 폴더 목록 첫 페이지를 반환한다', async () => {
    const repo = createRepository();
    repo.findDeletedFolders.mockResolvedValue([
      {
        id: 'folder-1',
        name: '삭제된 폴더',
        deletedAt: new Date(),
      },
    ]);

    const usecase = new ListTrashFoldersUseCase(repo);
    const result = await usecase.execute('user-1');

    expect(repo.findDeletedFolders).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: undefined,
      limit: 21,
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(result.hasNextPage).toBe(false);
  });

  it('limit보다 많은 결과가 있으면 다음 커서를 반환한다', async () => {
    const repo = createRepository();
    repo.findDeletedFolders.mockResolvedValue([
      {
        id: 'folder-1',
        name: '삭제된 폴더 1',
        deletedAt: new Date(),
      },
      {
        id: 'folder-2',
        name: '삭제된 폴더 2',
        deletedAt: new Date(),
      },
      {
        id: 'folder-3',
        name: '삭제된 폴더 3',
        deletedAt: new Date(),
      },
    ]);

    const usecase = new ListTrashFoldersUseCase(repo);
    const result = await usecase.execute('user-1', {
      cursor: 'folder-0',
      limit: 2,
    });

    expect(repo.findDeletedFolders).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: 'folder-0',
      limit: 3,
    });
    expect(result.items.map((item) => item.id)).toEqual([
      'folder-1',
      'folder-2',
    ]);
    expect(result.nextCursor).toBe('folder-2');
    expect(result.hasNextPage).toBe(true);
  });
});
