import { SaveFolderUseCase } from './save-folder.usecase';
import { FoldersRepository } from '../../domain/folders.repository';

const createRepository = (): jest.Mocked<FoldersRepository> => ({
  findPersonalWorkspaceId: jest.fn(),
  getOrCreatePersonalWorkspaceId: jest.fn(),
  findFoldersByWorkspaceId: jest.fn(),
  findPersonalFolderById: jest.fn(),
  findFolderById: jest.fn(),
  findFolderByIdInWorkspace: jest.fn(),
  findClipByIdInFolder: jest.fn(),
  findClipsByFolder: jest.fn(),
  findLastFolderOrder: jest.fn(),
  createFolder: jest.fn(),
  updateFolderName: jest.fn(),
  updateFolderOrder: jest.fn(),
  softDeleteFolder: jest.fn(),
  findPreviousFolderOrder: jest.fn(),
  findNextFolderOrder: jest.fn(),
});

describe('SaveFolderUseCase', () => {
  it('create 모드에서 워크스페이스가 없으면 생성 후 마지막 순서를 사용한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceId.mockResolvedValue('workspace-id');
    repo.findLastFolderOrder.mockResolvedValue(3);
    repo.createFolder.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new SaveFolderUseCase(repo);
    const result = await usecase.execute('user-id', {
      mode: 'create',
      name: 'Inbox',
    });

    expect(repo.createFolder).toHaveBeenCalledWith({
      name: 'Inbox',
      order: 4,
      workspaceId: 'workspace-id',
    });
    expect(result).toEqual({ id: 'folder-id' });
  });

  it('create 모드에서 마지막 폴더가 없으면 기본 순서를 사용한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceId.mockResolvedValue('workspace-id');
    repo.findLastFolderOrder.mockResolvedValue(null);
    repo.createFolder.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new SaveFolderUseCase(repo);
    await usecase.execute('user-id', {
      mode: 'create',
      name: 'Inbox',
    });

    expect(repo.createFolder).toHaveBeenCalledWith({
      name: 'Inbox',
      order: 1,
      workspaceId: 'workspace-id',
    });
  });

  it('update 모드에서 폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new SaveFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        mode: 'update',
        folderId: 'folder-id',
        name: 'Renamed',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('update 모드에서 이름이 없으면 기존 폴더를 반환한다', async () => {
    const repo = createRepository();
    const folder = { id: 'folder-id' };
    repo.findPersonalFolderById.mockResolvedValue(folder as never);

    const usecase = new SaveFolderUseCase(repo);
    const result = await usecase.execute('user-id', {
      mode: 'update',
      folderId: 'folder-id',
    });

    expect(repo.updateFolderName).not.toHaveBeenCalled();
    expect(result).toBe(folder);
  });

  it('update 모드에서 이름이 있으면 업데이트한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.updateFolderName.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new SaveFolderUseCase(repo);
    await usecase.execute('user-id', {
      mode: 'update',
      folderId: 'folder-id',
      name: 'Renamed',
    });

    expect(repo.updateFolderName).toHaveBeenCalledWith('folder-id', 'Renamed');
  });
});
