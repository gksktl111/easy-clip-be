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
});

describe('ListTrashFoldersUseCase', () => {
  it('휴지통 폴더 목록을 반환한다', async () => {
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

    expect(repo.findDeletedFolders).toHaveBeenCalledWith('user-1');
    expect(result.items).toHaveLength(1);
  });
});
