/* eslint-disable @typescript-eslint/unbound-method */
import { GetFolderUseCase } from './get-folder.usecase';
import { createFoldersRepositoryMock as createRepository } from '../../test-support/create-folders-repository-mock';

describe('GetFolderUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new GetFolderUseCase(repo);

    await expect(usecase.execute('user-id', 'folder-id')).rejects.toMatchObject(
      {
        code: 'NOT_FOUND',
      },
    );
  });

  it('폴더를 조회한다', async () => {
    const repo = createRepository();
    const folder = { id: 'folder-id' };
    repo.findPersonalFolderById.mockResolvedValue(folder as never);

    const usecase = new GetFolderUseCase(repo);
    const result = await usecase.execute('user-id', 'folder-id');

    expect(repo.findPersonalFolderById).toHaveBeenCalledWith(
      'user-id',
      'folder-id',
    );
    expect(result).toBe(folder);
  });
});
