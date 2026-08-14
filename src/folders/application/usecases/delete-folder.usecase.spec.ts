/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteFolderUseCase } from './delete-folder.usecase';
import { createFoldersRepositoryMock as createRepository } from '../../test-support/create-folders-repository-mock';

describe('DeleteFolderUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new DeleteFolderUseCase(repo);

    await expect(usecase.execute('user-id', 'folder-id')).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('폴더를 삭제한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.softDeleteFolder.mockResolvedValue({
      id: 'folder-id',
    } as never);

    const usecase = new DeleteFolderUseCase(repo);
    await usecase.execute('user-id', 'folder-id');

    expect(repo.softDeleteFolder).toHaveBeenCalledWith('folder-id');
  });
});
