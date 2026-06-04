/* eslint-disable @typescript-eslint/unbound-method */
import { UpdateFolderUseCase } from './update-folder.usecase';
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
  softDeleteFolder: jest.fn(),
  findPreviousFolderOrder: jest.fn(),
  findNextFolderOrder: jest.fn(),
});

describe('UpdateFolderUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new UpdateFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', 'folder-id', 'Renamed'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('이름이 없으면 기존 폴더를 반환한다', async () => {
    const repo = createRepository();
    const folder = { id: 'folder-id' };
    repo.findPersonalFolderById.mockResolvedValue(folder as never);

    const usecase = new UpdateFolderUseCase(repo);
    const result = await usecase.execute('user-id', 'folder-id');

    expect(repo.updateFolderName).not.toHaveBeenCalled();
    expect(result).toBe(folder);
  });

  it('이름이 있으면 업데이트한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.updateFolderName.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new UpdateFolderUseCase(repo);
    await usecase.execute('user-id', 'folder-id', 'Renamed');

    expect(repo.updateFolderName).toHaveBeenCalledWith('folder-id', 'Renamed');
  });
});
