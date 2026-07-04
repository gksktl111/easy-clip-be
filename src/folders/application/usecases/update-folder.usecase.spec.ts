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
  findTagsByFolderId: jest.fn(),
  findTagByIdInFolder: jest.fn(),
  findTagByNameInFolder: jest.fn(),
  findLastFolderOrder: jest.fn(),
  createFolder: jest.fn(),
  createFolderTag: jest.fn(),
  updateFolderName: jest.fn(),
  updateFolderTagName: jest.fn(),
  updateFolderOrder: jest.fn(),
  deleteFolderTag: jest.fn(),
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
      usecase.execute('user-id', { folderId: 'folder-id', name: 'Renamed' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('이름이 없으면 기존 폴더를 반환한다', async () => {
    const repo = createRepository();
    const folder = { id: 'folder-id' };
    repo.findPersonalFolderById.mockResolvedValue(folder as never);

    const usecase = new UpdateFolderUseCase(repo);
    const result = await usecase.execute('user-id', { folderId: 'folder-id' });

    expect(repo.updateFolderName).not.toHaveBeenCalled();
    expect(result).toBe(folder);
  });

  it('이름이 있으면 업데이트한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.updateFolderName.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new UpdateFolderUseCase(repo);
    await usecase.execute('user-id', {
      folderId: 'folder-id',
      name: 'Renamed',
    });

    expect(repo.updateFolderName).toHaveBeenCalledWith('folder-id', 'Renamed');
  });

  it('폴더명을 trim한 값으로 수정한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.updateFolderName.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new UpdateFolderUseCase(repo);
    await usecase.execute('user-id', {
      folderId: 'folder-id',
      name: '  Renamed  ',
    });

    expect(repo.updateFolderName).toHaveBeenCalledWith('folder-id', 'Renamed');
  });

  it('trim 후 폴더명이 비어있으면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new UpdateFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', { folderId: 'folder-id', name: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.updateFolderName).not.toHaveBeenCalled();
  });

  it('폴더명이 10자를 초과하면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);

    const usecase = new UpdateFolderUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        name: '가'.repeat(11),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.updateFolderName).not.toHaveBeenCalled();
  });
});
