/* eslint-disable @typescript-eslint/unbound-method */
import { ListFolderClipsUseCase } from './list-folder-clips.usecase';
import { ClipsRepository } from '../../domain/clips.repository';

const createRepository = (): jest.Mocked<ClipsRepository> => ({
  findPersonalFolderById: jest.fn(),
  findClipByIdForUser: jest.fn(),
  findClips: jest.fn(),
  findRecentClips: jest.fn(),
  hasTitleMatches: jest.fn(),
  hasRecentTitleMatches: jest.fn(),
  isClipMatchingQuery: jest.fn(),
  isRecentCursorMatchingQuery: jest.fn(),
  isClipLikedByUser: jest.fn(),
  createClip: jest.fn(),
  updateClip: jest.fn(),
  softDeleteClip: jest.fn(),
});

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

  it('좋아요된 클립이 limit보다 많으면 좋아요 목록만 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.findClips.mockResolvedValue(createClips(21) as never);

    const usecase = new ListFolderClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      cursor: '',
      type: 'ALL',
    });

    expect(repo.findClips).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe('clip-20');
  });

  it('좋아요된 클립과 좋아요되지 않은 클립을 결합해 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.findClips
      .mockResolvedValueOnce([{ id: 'liked-1' }] as never)
      .mockResolvedValueOnce(createClips(2, 'normal') as never);

    const usecase = new ListFolderClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      cursor: '',
      type: 'ALL',
    });

    expect(repo.findClips).toHaveBeenNthCalledWith(1, {
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      limit: 20,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
      likedOnly: true,
      cursor: undefined,
    });
    expect(repo.findClips).toHaveBeenNthCalledWith(2, {
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      limit: 19,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
      likedOnly: false,
    });
    expect(result.items.map((item) => item.id)).toEqual([
      'liked-1',
      'normal-1',
      'normal-2',
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('커서가 좋아요된 클립을 가리키면 좋아요 목록을 이어 조회한다', async () => {
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
    repo.isClipLikedByUser.mockResolvedValue(true);
    repo.findClips.mockResolvedValue(createClips(21, 'liked') as never);

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
      likedOnly: true,
      cursor: 'cursor-id',
    });
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe('liked-20');
  });

  it('커서가 좋아요되지 않은 클립을 가리키면 일반 목록을 이어 조회한다', async () => {
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
    repo.isClipLikedByUser.mockResolvedValue(false);
    repo.findClips.mockResolvedValue([{ id: 'normal-1' }] as never);

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
      likedOnly: false,
      cursor: 'cursor-id',
    });
    expect(result.items.map((item) => item.id)).toEqual(['normal-1']);
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
      likedOnly: undefined,
    });
    expect(repo.findClips).toHaveBeenCalledWith({
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      limit: 20,
      type: undefined,
      q: 'keyword',
      searchTarget: 'tag',
      likedOnly: true,
      cursor: undefined,
    });
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe('clip-20');
  });

  it('좋아요된 클립이 limit만큼이고 다음 일반 클립이 있으면 커서를 유지한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);
    repo.findClips
      .mockResolvedValueOnce(createClips(20, 'liked') as never)
      .mockResolvedValueOnce([{ id: 'normal-1' }] as never);

    const usecase = new ListFolderClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      cursor: '',
      type: 'ALL',
    });

    expect(repo.findClips).toHaveBeenNthCalledWith(1, {
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      limit: 20,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
      likedOnly: true,
      cursor: undefined,
    });
    expect(repo.findClips).toHaveBeenNthCalledWith(2, {
      userId: 'user-id',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      limit: 1,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
      likedOnly: false,
    });
    expect(result.items.map((item) => item.id)).toEqual([
      'liked-1',
      'liked-2',
      'liked-3',
      'liked-4',
      'liked-5',
      'liked-6',
      'liked-7',
      'liked-8',
      'liked-9',
      'liked-10',
      'liked-11',
      'liked-12',
      'liked-13',
      'liked-14',
      'liked-15',
      'liked-16',
      'liked-17',
      'liked-18',
      'liked-19',
      'liked-20',
    ]);
    expect(result.nextCursor).toBe('liked-20');
  });
});
