/* eslint-disable @typescript-eslint/unbound-method */
import { GetFolderUseCase } from './get-folder.usecase';
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

describe('GetFolderUseCase', () => {
  it('single 모드에서 폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new GetFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', { mode: 'single', folderId: 'folder-id' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('single 모드에서 폴더를 조회한다', async () => {
    const repo = createRepository();
    const folder = { id: 'folder-id' };
    repo.findPersonalFolderById.mockResolvedValue(folder as never);

    const usecase = new GetFolderUseCase(repo);
    const result = await usecase.execute('user-id', {
      mode: 'single',
      folderId: 'folder-id',
    });

    expect(repo.findPersonalFolderById).toHaveBeenCalledWith(
      'user-id',
      'folder-id',
    );
    expect(result).toBe(folder);
  });

  it('list 모드에서 워크스페이스가 없으면 빈 배열을 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalWorkspaceId.mockResolvedValue(null);

    const usecase = new GetFolderUseCase(repo);
    const result = await usecase.execute('user-id', { mode: 'list' });

    expect(result).toEqual([]);
    expect(repo.findFoldersByWorkspaceId).not.toHaveBeenCalled();
  });

  it('list 모드에서 폴더 목록을 조회한다', async () => {
    const repo = createRepository();
    const folders = [{ id: 'folder-1' }];
    repo.findPersonalWorkspaceId.mockResolvedValue('workspace-1');
    repo.findFoldersByWorkspaceId.mockResolvedValue(folders as never);

    const usecase = new GetFolderUseCase(repo);
    const result = await usecase.execute('user-id', { mode: 'list' });

    expect(repo.findFoldersByWorkspaceId).toHaveBeenCalledWith('workspace-1');
    expect(result).toBe(folders);
  });
});
