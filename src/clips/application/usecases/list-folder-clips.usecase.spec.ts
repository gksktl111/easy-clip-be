/* eslint-disable @typescript-eslint/unbound-method */
import { ListFolderClipsUseCase } from './list-folder-clips.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';

const createClips = (count: number, prefix = 'clip') =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
  }));

describe('ListFolderClipsUseCase', () => {
  it('폴더가 없으면 NOT_FOUND를 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new ListFolderClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
        cursor: '',
        type: 'ALL',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('좋아요 상태와 무관하게 저장소가 반환한 최신순 단일 페이지를 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.findClips.mockResolvedValue([
      { id: 'latest-1', likeByMe: false },
      { id: 'liked-2', likeByMe: true },
      ...createClips(19, 'older'),
    ] as never);

    const usecase = new ListFolderClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      cursor: '',
      type: 'ALL',
    });

    expect(repo.findClips).toHaveBeenCalledWith({
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      cursor: undefined,
      limit: 20,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
    });
    expect(repo.isClipLikedByUser).not.toHaveBeenCalled();
    expect(result.items.map((item) => item.id)).toEqual([
      'latest-1',
      'liked-2',
      ...createClips(18, 'older').map((item) => item.id),
    ]);
    expect(result.items).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('older-18');
  });

  it('커서가 있어도 좋아요 상태 조회 없이 최신순 조회를 이어간다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'cursor-id',
      type: 'TEXT',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.findClips.mockResolvedValue([{ id: 'after-cursor' }] as never);

    const usecase = new ListFolderClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      cursor: 'cursor-id',
      type: 'TEXT',
    });

    expect(repo.findClips).toHaveBeenCalledWith({
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      limit: 20,
      type: 'TEXT',
      q: undefined,
      searchTarget: undefined,
      cursor: 'cursor-id',
    });
    expect(repo.isClipLikedByUser).not.toHaveBeenCalled();
    expect(result.items.map((item) => item.id)).toEqual(['after-cursor']);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('타이틀 검색 결과가 없으면 태그 검색으로 폴백한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.hasTitleMatches.mockResolvedValue(false);
    repo.findClips.mockResolvedValue(createClips(21) as never);

    const usecase = new ListFolderClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      cursor: '',
      type: 'ALL',
      q: 'keyword',
    });

    expect(repo.hasTitleMatches).toHaveBeenCalledWith({
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      type: undefined,
      q: 'keyword',
      searchTarget: 'title',
    });
    expect(repo.findClips).toHaveBeenCalledWith({
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      limit: 20,
      type: undefined,
      q: 'keyword',
      searchTarget: 'tag',
      cursor: undefined,
    });
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe('clip-20');
  });
});
