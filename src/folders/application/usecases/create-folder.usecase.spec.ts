/* eslint-disable @typescript-eslint/unbound-method */
import { CreateFolderUseCase } from './create-folder.usecase';
import { createFoldersRepositoryMock as createRepository } from '../../test-support/create-folders-repository-mock';

describe('CreateFolderUseCase', () => {
  it('워크스페이스가 없으면 생성 후 마지막 순서를 사용한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceId.mockResolvedValue('workspace-id');
    repo.findLastFolderOrder.mockResolvedValue(3);
    repo.createFolder.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new CreateFolderUseCase(repo);
    const result = await usecase.execute('user-id', { name: 'Inbox' });

    expect(repo.createFolder).toHaveBeenCalledWith({
      name: 'Inbox',
      order: 4,
      workspaceId: 'workspace-id',
    });
    expect(result).toEqual({ id: 'folder-id' });
  });

  it('폴더명을 trim한 값으로 생성한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceId.mockResolvedValue('workspace-id');
    repo.findLastFolderOrder.mockResolvedValue(null);
    repo.createFolder.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new CreateFolderUseCase(repo);
    await usecase.execute('user-id', { name: '  Inbox  ' });

    expect(repo.createFolder).toHaveBeenCalledWith({
      name: 'Inbox',
      order: 1,
      workspaceId: 'workspace-id',
    });
  });

  it('trim 후 폴더명이 비어있으면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new CreateFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', { name: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.getOrCreatePersonalWorkspaceId).not.toHaveBeenCalled();
  });

  it('폴더명이 10자를 초과하면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new CreateFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', { name: '가'.repeat(11) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.getOrCreatePersonalWorkspaceId).not.toHaveBeenCalled();
  });

  it('마지막 폴더가 없으면 기본 순서를 사용한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceId.mockResolvedValue('workspace-id');
    repo.findLastFolderOrder.mockResolvedValue(null);
    repo.createFolder.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new CreateFolderUseCase(repo);
    await usecase.execute('user-id', { name: 'Inbox' });

    expect(repo.createFolder).toHaveBeenCalledWith({
      name: 'Inbox',
      order: 1,
      workspaceId: 'workspace-id',
    });
  });
});
