/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteTrashFolderUseCase } from './delete-trash-folder.usecase';
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

describe('DeleteTrashFolderUseCase', () => {
  it('휴지통 폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findDeletedFolderById.mockResolvedValue(null);

    const usecase = new DeleteTrashFolderUseCase(repo);

    await expect(usecase.execute('user-1', 'folder-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('휴지통 폴더와 하위 클립을 함께 영구 삭제한다', async () => {
    const repo = createRepository();
    repo.findDeletedFolderById.mockResolvedValue({
      id: 'folder-1',
      name: '삭제된 폴더',
      deletedAt: new Date(),
    });

    const usecase = new DeleteTrashFolderUseCase(repo);
    const result = await usecase.execute('user-1', 'folder-1');

    expect(repo.hardDeleteFolderWithClips).toHaveBeenCalledWith('folder-1');
    expect(result).toEqual({ success: true });
  });
});
