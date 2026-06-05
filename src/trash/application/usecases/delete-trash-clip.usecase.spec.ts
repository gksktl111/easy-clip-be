/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteTrashClipUseCase } from './delete-trash-clip.usecase';
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

describe('DeleteTrashClipUseCase', () => {
  it('휴지통 클립이 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findDeletedClipById.mockResolvedValue(null);

    const usecase = new DeleteTrashClipUseCase(repo);

    await expect(usecase.execute('user-1', 'clip-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('휴지통 클립을 영구 삭제한다', async () => {
    const repo = createRepository();
    repo.findDeletedClipById.mockResolvedValue({
      id: 'clip-1',
      title: '삭제된 클립',
      type: 'TEXT',
      folderId: 'folder-1',
      deletedAt: new Date(),
    });

    const usecase = new DeleteTrashClipUseCase(repo);
    const result = await usecase.execute('user-1', 'clip-1');

    expect(repo.hardDeleteClip).toHaveBeenCalledWith('clip-1');
    expect(result).toEqual({ success: true });
  });
});
