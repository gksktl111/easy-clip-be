/* eslint-disable @typescript-eslint/unbound-method */
import { ListRecentClipsUseCase } from './list-recent-clips.usecase';
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
  findRecentViewedClipIds: jest.fn(),
  findClipsByIdsForUser: jest.fn(),
  createClipView: jest.fn(),
  isClipLikedByUser: jest.fn(),
  createClipLike: jest.fn(),
  deleteClipLike: jest.fn(),
  createClip: jest.fn(),
  updateClip: jest.fn(),
  softDeleteClip: jest.fn(),
  softDeleteClips: jest.fn(),
  softDeleteAllClipsForUser: jest.fn(),
});

describe('ListRecentClipsUseCase', () => {
  it('조회 기록 기준으로 목록을 반환한다', async () => {
    const repo = createRepository();
    repo.findRecentClips
      .mockResolvedValueOnce([
        { id: 'clip-1', viewId: 'view-1' },
        { id: 'clip-2', viewId: 'view-2' },
        { id: 'clip-3', viewId: 'view-3' },
      ] as never)
      .mockResolvedValueOnce([] as never);

    const usecase = new ListRecentClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      cursor: '',
      type: 'ALL',
    });

    expect(repo.findRecentClips).toHaveBeenNthCalledWith(1, {
      userId: 'user-id',
      cursor: undefined,
      limit: 20,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
      likedOnly: true,
    });
    expect(repo.findRecentClips).toHaveBeenNthCalledWith(2, {
      userId: 'user-id',
      limit: 17,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
      likedOnly: false,
    });
    expect(result.items).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('커서가 유효하지 않으면 NOT_FOUND를 반환한다', async () => {
    const repo = createRepository();
    repo.isRecentCursorMatchingQuery.mockResolvedValue(null);

    const usecase = new ListRecentClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        cursor: 'view-1',
        type: 'ALL',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
