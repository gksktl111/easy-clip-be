/* eslint-disable @typescript-eslint/unbound-method */
import { FoldersRepository } from '../../domain/folders.repository';
import { UpdateFolderTagUseCase } from './update-folder-tag.usecase';

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
  softDeleteFolderWithClips: jest.fn(),
  findPreviousFolderOrder: jest.fn(),
  findNextFolderOrder: jest.fn(),
});

describe('UpdateFolderTagUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new UpdateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        tagId: 'tag-id',
        name: 'frontend',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('태그가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue(null);

    const usecase = new UpdateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        tagId: 'tag-id',
        name: 'frontend',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('다른 태그와 이름이 중복되면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue({
      id: 'tag-id',
      name: 'backend',
    } as never);
    repo.findTagByNameInFolder.mockResolvedValue({
      id: 'other-tag-id',
      name: 'frontend',
    } as never);

    const usecase = new UpdateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        tagId: 'tag-id',
        name: 'frontend',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('정규화된 태그명 기준으로 중복을 검사한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue({
      id: 'tag-id',
      name: 'backend',
    } as never);
    repo.findTagByNameInFolder.mockResolvedValue({
      id: 'other-tag-id',
      name: 'frontend',
    } as never);

    const usecase = new UpdateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        tagId: 'tag-id',
        name: ' frontend ',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(repo.findTagByNameInFolder).toHaveBeenCalledWith(
      'folder-id',
      'frontend',
    );
  });

  it('trim 후 태그명이 비어있으면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new UpdateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        tagId: 'tag-id',
        name: '   ',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.findPersonalFolderById).not.toHaveBeenCalled();
  });

  it('태그명이 10자를 초과하면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new UpdateFolderTagUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        tagId: 'tag-id',
        name: 'a'.repeat(11),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.findPersonalFolderById).not.toHaveBeenCalled();
  });

  it('이름이 같으면 기존 태그를 반환한다', async () => {
    const repo = createRepository();
    const tag = { id: 'tag-id', name: 'backend', folderId: 'folder-id' };
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue(tag as never);
    repo.findTagByNameInFolder.mockResolvedValue(tag as never);

    const usecase = new UpdateFolderTagUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      tagId: 'tag-id',
      name: 'backend',
    });

    expect(repo.updateFolderTagName).not.toHaveBeenCalled();
    expect(result).toBe(tag);
  });

  it('태그 이름을 수정한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({ id: 'folder-id' } as never);
    repo.findTagByIdInFolder.mockResolvedValue({
      id: 'tag-id',
      name: 'backend',
      folderId: 'folder-id',
    } as never);
    repo.findTagByNameInFolder.mockResolvedValue(null);
    repo.updateFolderTagName.mockResolvedValue({
      id: 'tag-id',
      name: 'frontend',
      folderId: 'folder-id',
    } as never);

    const usecase = new UpdateFolderTagUseCase(repo);
    await usecase.execute('user-id', {
      folderId: 'folder-id',
      tagId: 'tag-id',
      name: ' frontend ',
    });

    expect(repo.updateFolderTagName).toHaveBeenCalledWith('tag-id', 'frontend');
  });
});
