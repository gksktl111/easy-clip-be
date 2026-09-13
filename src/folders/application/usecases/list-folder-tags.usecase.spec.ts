/* eslint-disable @typescript-eslint/unbound-method */
import { FolderAccessError } from 'src/shared/application/folder-access';
import { createFoldersRepositoryMock as createRepository } from '../../test-support/create-folders-repository-mock';
import { ListFolderTagsUseCase } from './list-folder-tags.usecase';

describe('ListFolderTagsUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new ListFolderTagsUseCase(repo);

    await expect(usecase.execute('user-id', 'folder-id')).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('폴더 태그 목록을 조회한다', async () => {
    const repo = createRepository();
    const tags = [{ id: 'tag-id', name: 'backend', folderId: 'folder-id' }];
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagsByFolderId.mockResolvedValue(tags as never);

    const usecase = new ListFolderTagsUseCase(repo);
    const result = await usecase.execute('user-id', 'folder-id');

    expect(repo.findTagsByFolderId).toHaveBeenCalledWith('folder-id');
    expect(result).toBe(tags);
  });

  it('태그 조회 트랜잭션의 Free 제한 오류를 전달한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagsByFolderId.mockRejectedValue(
      new FolderAccessError('FEATURE_NOT_AVAILABLE', 'Pro 전용 기능입니다.'),
    );

    await expect(
      new ListFolderTagsUseCase(repo).execute('user-id', 'folder-id'),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      policyCode: 'FEATURE_NOT_AVAILABLE',
    });
  });
});
