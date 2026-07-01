/* eslint-disable @typescript-eslint/unbound-method */
import { TrashRepository } from '../../domain/trash.repository';
import { ListTrashItemsUseCase } from './list-trash-items.usecase';

const createRepository = (): jest.Mocked<TrashRepository> => ({
  findDeletedItems: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreClip: jest.fn(),
  hardDeleteClip: jest.fn(),
  findDeletedFolderById: jest.fn(),
  restoreFolderWithClips: jest.fn(),
  hardDeleteFolderWithClips: jest.fn(),
  hardDeleteExpiredFoldersWithClips: jest.fn(),
  hardDeleteExpiredClips: jest.fn(),
  hardDeleteAllTrashItemsForUser: jest.fn(),
});

describe('ListTrashItemsUseCase', () => {
  it('휴지통 클립과 폴더 목록 첫 페이지를 반환한다', async () => {
    const repo = createRepository();
    const deletedAt = new Date();
    repo.findDeletedItems.mockResolvedValue([
      {
        itemType: 'CLIP',
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
      },
      {
        itemType: 'FOLDER',
        id: 'folder-1',
        name: '삭제된 폴더',
        deletedAt,
      },
    ]);

    const usecase = new ListTrashItemsUseCase(repo);
    const result = await usecase.execute('user-1');

    expect(repo.findDeletedItems).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: undefined,
      limit: 21,
    });
    expect(result.items).toEqual([
      {
        itemType: 'CLIP',
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
      },
      {
        itemType: 'FOLDER',
        id: 'folder-1',
        name: '삭제된 폴더',
        deletedAt,
      },
    ]);
    expect(result.nextCursor).toBeNull();
    expect(result.hasNextPage).toBe(false);
  });

  it('limit보다 많은 결과가 있으면 항목 유형을 포함한 다음 커서를 반환한다', async () => {
    const repo = createRepository();
    const deletedAt = new Date();
    repo.findDeletedItems.mockResolvedValue([
      {
        itemType: 'CLIP',
        id: 'clip-1',
        title: '삭제된 클립 1',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
      },
      {
        itemType: 'FOLDER',
        id: 'folder-1',
        name: '삭제된 폴더 1',
        deletedAt,
      },
      {
        itemType: 'CLIP',
        id: 'clip-2',
        title: '삭제된 클립 2',
        type: 'IMAGE',
        folderId: 'folder-2',
        deletedAt,
      },
    ]);

    const usecase = new ListTrashItemsUseCase(repo);
    const result = await usecase.execute('user-1', {
      cursor: 'CLIP:clip-0',
      limit: 2,
    });

    expect(repo.findDeletedItems).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: 'CLIP:clip-0',
      limit: 3,
    });
    expect(result.items.map((item) => `${item.itemType}:${item.id}`)).toEqual([
      'CLIP:clip-1',
      'FOLDER:folder-1',
    ]);
    expect(result.nextCursor).toBe('FOLDER:folder-1');
    expect(result.hasNextPage).toBe(true);
  });
});
