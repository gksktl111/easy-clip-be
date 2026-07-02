/* eslint-disable @typescript-eslint/unbound-method */
import { FoldersRepository } from '../../domain/folders.repository';
import { CreateFolderTagUseCase } from './create-folder-tag.usecase';

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

describe('CreateFolderTagUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new CreateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', { folderId: 'folder-id', name: 'backend' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('같은 폴더에 같은 이름의 태그가 있으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByNameInFolder.mockResolvedValue({ id: 'tag-id' } as never);

    const usecase = new CreateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', { folderId: 'folder-id', name: 'backend' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('정규화된 태그명 기준으로 중복을 검사한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByNameInFolder.mockResolvedValue({ id: 'tag-id' } as never);

    const usecase = new CreateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', { folderId: 'folder-id', name: ' backend ' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(repo.findTagByNameInFolder).toHaveBeenCalledWith(
      'folder-id',
      'backend',
    );
  });

  it('trim 후 태그명이 비어있으면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new CreateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', { folderId: 'folder-id', name: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.findPersonalFolderById).not.toHaveBeenCalled();
  });

  it('태그명이 10자를 초과하면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new CreateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        name: 'a'.repeat(11),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.findPersonalFolderById).not.toHaveBeenCalled();
  });

  it('폴더 태그를 생성한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByNameInFolder.mockResolvedValue(null);
    repo.createFolderTag.mockResolvedValue({
      id: 'tag-id',
      folderId: 'folder-id',
      name: 'backend',
    } as never);

    const usecase = new CreateFolderTagUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      name: ' backend ',
    });

    expect(repo.createFolderTag).toHaveBeenCalledWith({
      folderId: 'folder-id',
      name: 'backend',
    });
    expect(result.id).toBe('tag-id');
  });
});
