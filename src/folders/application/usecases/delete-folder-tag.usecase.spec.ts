/* eslint-disable @typescript-eslint/unbound-method */
import { FolderAccessError } from 'src/shared/application/folder-access';
import { createFoldersRepositoryMock as createRepository } from '../../test-support/create-folders-repository-mock';
import { DeleteFolderTagUseCase } from './delete-folder-tag.usecase';

describe('DeleteFolderTagUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new DeleteFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', 'folder-id', 'tag-id'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('태그가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue(null);

    const usecase = new DeleteFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', 'folder-id', 'tag-id'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('태그를 삭제한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue({ id: 'tag-id' } as never);

    const usecase = new DeleteFolderTagUseCase(repo);
    await usecase.execute('user-id', 'folder-id', 'tag-id');

    expect(repo.deleteFolderTag).toHaveBeenCalledWith('tag-id');
  });

  it('태그 삭제 트랜잭션의 Free 제한 오류를 전달한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue({ id: 'tag-id' } as never);
    repo.deleteFolderTag.mockRejectedValue(
      new FolderAccessError('FEATURE_NOT_AVAILABLE', 'Pro 전용 기능입니다.'),
    );

    await expect(
      new DeleteFolderTagUseCase(repo).execute(
        'user-id',
        'folder-id',
        'tag-id',
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      policyCode: 'FEATURE_NOT_AVAILABLE',
    });
  });
});
