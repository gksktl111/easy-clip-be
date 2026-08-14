/* eslint-disable @typescript-eslint/unbound-method */
import { ListFoldersUseCase } from './list-folders.usecase';
import { createFoldersRepositoryMock as createRepository } from '../../test-support/create-folders-repository-mock';

describe('ListFoldersUseCase', () => {
  it('워크스페이스가 없으면 빈 배열을 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalWorkspaceId.mockResolvedValue(null);

    const usecase = new ListFoldersUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(result).toEqual([]);
    expect(repo.findFoldersByWorkspaceId).not.toHaveBeenCalled();
  });

  it('폴더 목록을 조회한다', async () => {
    const repo = createRepository();
    const folders = [{ id: 'folder-1' }];
    repo.findPersonalWorkspaceId.mockResolvedValue('workspace-1');
    repo.findFoldersByWorkspaceId.mockResolvedValue(folders as never);

    const usecase = new ListFoldersUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.findFoldersByWorkspaceId).toHaveBeenCalledWith('workspace-1');
    expect(result).toBe(folders);
  });
});
