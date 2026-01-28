import { GetFolderUseCase } from './get-folder.usecase';
import { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../folders.error';

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
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new GetFolderUseCase(repo);

    await expect(usecase.execute('user-id', 'folder-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('폴더를 조회한다', async () => {
    const repo = createRepository();
    const folder = { id: 'folder-id' };
    repo.findPersonalFolderById.mockResolvedValue(folder as never);

    const usecase = new GetFolderUseCase(repo);
    const result = await usecase.execute('user-id', 'folder-id');

    expect(result).toBe(folder);
  });
});
