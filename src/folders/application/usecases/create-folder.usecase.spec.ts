/* eslint-disable @typescript-eslint/unbound-method */
import { CreateFolderUseCase } from './create-folder.usecase';
import { FoldersRepository } from '../../domain/folders.repository';

const createRepository = (): jest.Mocked<FoldersRepository> => ({
  findPersonalWorkspaceId: jest.fn(),
  getOrCreatePersonalWorkspaceId: jest.fn(),
  findFoldersByWorkspaceId: jest.fn(),
  findPersonalFolderById: jest.fn(),
  findFolderById: jest.fn(),
  findFolderByIdInWorkspace: jest.fn(),
  findLastFolderOrder: jest.fn(),
  createFolder: jest.fn(),
  updateFolderName: jest.fn(),
  updateFolderOrder: jest.fn(),
  softDeleteFolderWithClips: jest.fn(),
  findPreviousFolderOrder: jest.fn(),
  findNextFolderOrder: jest.fn(),
});

describe('CreateFolderUseCase', () => {
  it('워크스페이스가 없으면 생성 후 마지막 순서를 사용한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceId.mockResolvedValue('workspace-id');
    repo.findLastFolderOrder.mockResolvedValue(3);
    repo.createFolder.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new CreateFolderUseCase(repo);
    const result = await usecase.execute('user-id', 'Inbox');

    expect(repo.createFolder).toHaveBeenCalledWith({
      name: 'Inbox',
      order: 4,
      workspaceId: 'workspace-id',
    });
    expect(result).toEqual({ id: 'folder-id' });
  });

  it('마지막 폴더가 없으면 기본 순서를 사용한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceId.mockResolvedValue('workspace-id');
    repo.findLastFolderOrder.mockResolvedValue(null);
    repo.createFolder.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new CreateFolderUseCase(repo);
    await usecase.execute('user-id', 'Inbox');

    expect(repo.createFolder).toHaveBeenCalledWith({
      name: 'Inbox',
      order: 1,
      workspaceId: 'workspace-id',
    });
  });
});
