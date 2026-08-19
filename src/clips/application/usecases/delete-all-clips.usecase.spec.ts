/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteAllClipsUseCase } from './delete-all-clips.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';

describe('DeleteAllClipsUseCase', () => {
  it('사용자가 접근할 수 있는 폴더의 클립을 전체 소프트 삭제한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    repo.softDeleteAllClipsInFolder.mockResolvedValue(3);

    const usecase = new DeleteAllClipsUseCase(repo);
    const result = await usecase.execute('user-id', 'folder-id');

    expect(repo.findPersonalFolderById).toHaveBeenCalledWith(
      'user-id',
      'folder-id',
    );
    expect(repo.softDeleteAllClipsInFolder).toHaveBeenCalledWith(
      'user-id',
      'folder-id',
    );
    expect(result).toEqual({ deletedCount: 3 });
  });

  it('접근할 수 없는 폴더면 NOT_FOUND를 반환하고 삭제하지 않는다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new DeleteAllClipsUseCase(repo);

    await expect(usecase.execute('user-id', 'folder-id')).rejects.toMatchObject(
      {
        code: 'NOT_FOUND',
      },
    );
    expect(repo.softDeleteAllClipsInFolder).not.toHaveBeenCalled();
  });

  it('삭제할 활성 클립이 없어도 0개 삭제 결과를 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    repo.softDeleteAllClipsInFolder.mockResolvedValue(0);

    const usecase = new DeleteAllClipsUseCase(repo);
    const result = await usecase.execute('user-id', 'folder-id');

    expect(result).toEqual({ deletedCount: 0 });
  });
});
