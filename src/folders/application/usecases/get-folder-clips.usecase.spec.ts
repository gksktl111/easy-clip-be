import { GetFolderClipsUseCase } from './get-folder-clips.usecase';
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

describe('GetFolderClipsUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new GetFolderClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', 'folder-id', {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('커서 클립이 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.findClipByIdInFolder.mockResolvedValue(null);

    const usecase = new GetFolderClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', 'folder-id', { cursor: 'clip-id' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('클립 목록과 nextCursor를 계산한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.findClipsByFolder.mockResolvedValue([
      { id: 'clip-1' },
      { id: 'clip-2' },
      { id: 'clip-3' },
    ] as never);

    const usecase = new GetFolderClipsUseCase(repo);
    const result = await usecase.execute('user-id', 'folder-id', { limit: 2 });

    expect(repo.findClipsByFolder).toHaveBeenCalledWith({
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      cursor: undefined,
      limit: 2,
    });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('clip-2');
  });
});
