/* eslint-disable @typescript-eslint/unbound-method */
import { RestoreTrashClipUseCase } from './restore-trash-clip.usecase';
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

describe('RestoreTrashClipUseCase', () => {
  it('휴지통 클립이 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findDeletedClipById.mockResolvedValue(null);

    const usecase = new RestoreTrashClipUseCase(repo);

    await expect(usecase.execute('user-1', 'clip-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('휴지통 클립을 복구한다', async () => {
    const repo = createRepository();
    const clip = {
      id: 'clip-1',
      title: '삭제된 클립',
      type: 'TEXT' as const,
      folderId: 'folder-1',
      deletedAt: new Date(),
    };
    repo.findDeletedClipById.mockResolvedValue(clip);
    repo.restoreClip.mockResolvedValue({
      ...clip,
      deletedAt: null as never,
    });

    const usecase = new RestoreTrashClipUseCase(repo);
    await usecase.execute('user-1', 'clip-1');

    expect(repo.restoreClip).toHaveBeenCalledWith('clip-1');
  });
});
