/* eslint-disable @typescript-eslint/unbound-method */
import { FoldersRepository } from '../../domain/folders.repository';
import { DeleteFolderTagUseCase } from './delete-folder-tag.usecase';

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

describe('DeleteFolderTagUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new DeleteFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', 'folder-id', 'tag-id'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('태그가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue(null);

    const usecase = new DeleteFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', 'folder-id', 'tag-id'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('태그를 삭제한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue({ id: 'tag-id' } as never);

    const usecase = new DeleteFolderTagUseCase(repo);
    await usecase.execute('user-id', 'folder-id', 'tag-id');

    expect(repo.deleteFolderTag).toHaveBeenCalledWith('tag-id');
  });
});
