/* eslint-disable @typescript-eslint/unbound-method */
import { TrashRepository } from '../../domain/trash.repository';
import { RestoreTrashItemsUseCase } from './restore-trash-items.usecase';

const createRepository = (): jest.Mocked<TrashRepository> => ({
  findDeletedItems: jest.fn(),
  findDeletedClipsByIds: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreItems: jest.fn(),
  hardDeleteClip: jest.fn(),
  findDeletedFoldersByIds: jest.fn(),
  findDeletedFolderById: jest.fn(),
  hardDeleteFolderWithClips: jest.fn(),
  hardDeleteExpiredFoldersWithClips: jest.fn(),
  hardDeleteExpiredClips: jest.fn(),
  hardDeleteAllTrashItemsForUser: jest.fn(),
});

describe('RestoreTrashItemsUseCase', () => {
  it('휴지통 클립 단건을 복구한다', async () => {
    const repo = createRepository();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
        folderDeletedAt: null,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([]);

    const usecase = new RestoreTrashItemsUseCase(repo);
    const result = await usecase.execute('user-1', {
      items: [{ itemType: 'CLIP', id: 'clip-1' }],
    });

    expect(repo.findDeletedClipsByIds).toHaveBeenCalledWith('user-1', [
      'clip-1',
    ]);
    expect(repo.restoreItems).toHaveBeenCalledWith({
      userId: 'user-1',
      clipIds: ['clip-1'],
      folderIds: [],
    });
    expect(result).toEqual({ restoredCount: 1 });
  });

  it('휴지통 폴더와 클립을 함께 복구한다', async () => {
    const repo = createRepository();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'IMAGE',
        folderId: 'folder-2',
        deletedAt,
        folderDeletedAt: null,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([
      {
        id: 'folder-1',
        name: '삭제된 폴더',
        deletedAt,
      },
    ]);

    const usecase = new RestoreTrashItemsUseCase(repo);
    const result = await usecase.execute('user-1', {
      items: [
        { itemType: 'FOLDER', id: 'folder-1' },
        { itemType: 'CLIP', id: 'clip-1' },
      ],
    });

    expect(repo.restoreItems).toHaveBeenCalledWith({
      userId: 'user-1',
      clipIds: ['clip-1'],
      folderIds: ['folder-1'],
    });
    expect(result).toEqual({ restoredCount: 2 });
  });

  it('같은 요청의 폴더에 속한 클립은 폴더 복구로 함께 처리한다', async () => {
    const repo = createRepository();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
        folderDeletedAt: deletedAt,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([
      {
        id: 'folder-1',
        name: '삭제된 폴더',
        deletedAt,
      },
    ]);

    const usecase = new RestoreTrashItemsUseCase(repo);
    const result = await usecase.execute('user-1', {
      items: [
        { itemType: 'FOLDER', id: 'folder-1' },
        { itemType: 'CLIP', id: 'clip-1' },
      ],
    });

    expect(repo.restoreItems).toHaveBeenCalledWith({
      userId: 'user-1',
      clipIds: [],
      folderIds: ['folder-1'],
    });
    expect(result).toEqual({ restoredCount: 2 });
  });

  it('삭제된 폴더 하위 클립만 단독 복구하면 에러를 던진다', async () => {
    const repo = createRepository();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
        folderDeletedAt: deletedAt,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([]);

    const usecase = new RestoreTrashItemsUseCase(repo);

    await expect(
      usecase.execute('user-1', {
        items: [{ itemType: 'CLIP', id: 'clip-1' }],
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(repo.restoreItems).not.toHaveBeenCalled();
  });

  it('요청한 휴지통 항목이 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findDeletedClipsByIds.mockResolvedValue([]);
    repo.findDeletedFoldersByIds.mockResolvedValue([]);

    const usecase = new RestoreTrashItemsUseCase(repo);

    await expect(
      usecase.execute('user-1', {
        items: [{ itemType: 'CLIP', id: 'clip-1' }],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('중복 요청 항목은 한 번만 복구한다', async () => {
    const repo = createRepository();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
        folderDeletedAt: null,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([]);

    const usecase = new RestoreTrashItemsUseCase(repo);
    const result = await usecase.execute('user-1', {
      items: [
        { itemType: 'CLIP', id: 'clip-1' },
        { itemType: 'CLIP', id: 'clip-1' },
      ],
    });

    expect(repo.findDeletedClipsByIds).toHaveBeenCalledWith('user-1', [
      'clip-1',
    ]);
    expect(repo.restoreItems).toHaveBeenCalledWith({
      userId: 'user-1',
      clipIds: ['clip-1'],
      folderIds: [],
    });
    expect(result).toEqual({ restoredCount: 1 });
  });
});
