/* eslint-disable @typescript-eslint/unbound-method */
import { ListTrashClipsUseCase } from './list-trash-clips.usecase';
import { TrashRepository } from '../../domain/trash.repository';

const createRepository = (): jest.Mocked<TrashRepository> => ({
  findDeletedClips: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreClip: jest.fn(),
  hardDeleteClip: jest.fn(),
  findDeletedFolders: jest.fn(),
  findDeletedFolderById: jest.fn(),
  restoreFolderWithClips: jest.fn(),
  hardDeleteFolderWithClips: jest.fn(),
  hardDeleteExpiredFoldersWithClips: jest.fn(),
  hardDeleteExpiredClips: jest.fn(),
});

describe('ListTrashClipsUseCase', () => {
  it('휴지통 클립 목록 첫 페이지를 반환한다', async () => {
    const repo = createRepository();
    repo.findDeletedClips.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt: new Date(),
      },
    ]);

    const usecase = new ListTrashClipsUseCase(repo);
    const result = await usecase.execute('user-1');

    expect(repo.findDeletedClips).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: undefined,
      limit: 21,
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(result.hasNextPage).toBe(false);
  });

  it('limit보다 많은 결과가 있으면 다음 커서를 반환한다', async () => {
    const repo = createRepository();
    repo.findDeletedClips.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립 1',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt: new Date(),
      },
      {
        id: 'clip-2',
        title: '삭제된 클립 2',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt: new Date(),
      },
      {
        id: 'clip-3',
        title: '삭제된 클립 3',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt: new Date(),
      },
    ]);

    const usecase = new ListTrashClipsUseCase(repo);
    const result = await usecase.execute('user-1', {
      cursor: 'clip-0',
      limit: 2,
    });

    expect(repo.findDeletedClips).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: 'clip-0',
      limit: 3,
    });
    expect(result.items.map((item) => item.id)).toEqual(['clip-1', 'clip-2']);
    expect(result.nextCursor).toBe('clip-2');
    expect(result.hasNextPage).toBe(true);
  });
});
