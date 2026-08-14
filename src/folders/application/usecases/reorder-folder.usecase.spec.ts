/* eslint-disable @typescript-eslint/unbound-method */
import { ReorderFolderUseCase } from './reorder-folder.usecase';
import { createFoldersRepositoryMock as createRepository } from '../../test-support/create-folders-repository-mock';

describe('ReorderFolderUseCase', () => {
  it('afterId/beforeId가 모두 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    const usecase = new ReorderFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', { targetId: 'target' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('이동 대상이 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new ReorderFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', { targetId: 'target', afterId: 'ref' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('beforeId 기준으로 순서를 계산한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'target',
      order: 10,
      workspaceId: 'workspace',
    } as never);
    repo.findFolderByIdInWorkspace.mockResolvedValue({
      id: 'ref',
      order: 20,
    } as never);
    repo.findPreviousFolderOrder.mockResolvedValue(null);
    repo.updateFolderOrder.mockResolvedValue({ id: 'target' } as never);

    const usecase = new ReorderFolderUseCase(repo);
    await usecase.execute('user-id', { targetId: 'target', beforeId: 'ref' });

    expect(repo.updateFolderOrder).toHaveBeenCalledWith('target', 19);
  });

  it('afterId 기준으로 순서를 계산한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'target',
      order: 10,
      workspaceId: 'workspace',
    } as never);
    repo.findFolderByIdInWorkspace.mockResolvedValue({
      id: 'ref',
      order: 20,
    } as never);
    repo.findNextFolderOrder.mockResolvedValue(null);
    repo.updateFolderOrder.mockResolvedValue({ id: 'target' } as never);

    const usecase = new ReorderFolderUseCase(repo);
    await usecase.execute('user-id', { targetId: 'target', afterId: 'ref' });

    expect(repo.updateFolderOrder).toHaveBeenCalledWith('target', 21);
  });
});
