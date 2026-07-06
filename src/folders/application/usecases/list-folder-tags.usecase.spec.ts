/* eslint-disable @typescript-eslint/unbound-method */
import { FoldersRepository } from '../../domain/folders.repository';
import { ListFolderTagsUseCase } from './list-folder-tags.usecase';

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

describe('ListFolderTagsUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new ListFolderTagsUseCase(repo);

    await expect(usecase.execute('user-id', 'folder-id')).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('폴더 태그 목록을 조회한다', async () => {
    const repo = createRepository();
    const tags = [{ id: 'tag-id', name: 'backend', folderId: 'folder-id' }];
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagsByFolderId.mockResolvedValue(tags as never);

    const usecase = new ListFolderTagsUseCase(repo);
    const result = await usecase.execute('user-id', 'folder-id');

    expect(repo.findTagsByFolderId).toHaveBeenCalledWith('folder-id');
    expect(result).toBe(tags);
  });
});
