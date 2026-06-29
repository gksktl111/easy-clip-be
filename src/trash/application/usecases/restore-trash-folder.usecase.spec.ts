/* eslint-disable @typescript-eslint/unbound-method */
import { RestoreTrashFolderUseCase } from './restore-trash-folder.usecase';
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
  hardDeleteAllTrashItemsForUser: jest.fn(),
});

describe('RestoreTrashFolderUseCase', () => {
  it('휴지통 폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findDeletedFolderById.mockResolvedValue(null);

    const usecase = new RestoreTrashFolderUseCase(repo);

    await expect(usecase.execute('user-1', 'folder-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('휴지통 폴더와 하위 클립을 함께 복구한다', async () => {
    const repo = createRepository();
    const folder = {
      id: 'folder-1',
      name: '삭제된 폴더',
      deletedAt: new Date(),
    };
    repo.findDeletedFolderById.mockResolvedValue(folder);
    repo.restoreFolderWithClips.mockResolvedValue({
      ...folder,
      deletedAt: null as never,
    });

    const usecase = new RestoreTrashFolderUseCase(repo);
    await usecase.execute('user-1', 'folder-1');

    expect(repo.restoreFolderWithClips).toHaveBeenCalledWith('folder-1');
  });
});
