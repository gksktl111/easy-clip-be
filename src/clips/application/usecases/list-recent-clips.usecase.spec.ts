/* eslint-disable @typescript-eslint/unbound-method */
import { ListRecentClipsUseCase } from './list-recent-clips.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';

describe('ListRecentClipsUseCase', () => {
  it('좋아요 상태와 무관하게 조회 기록 최신순 목록을 반환한다', async () => {
    const repo = createRepository();
    repo.findRecentClips.mockResolvedValue([
      { id: 'recent-1', viewId: 'view-1', likeByMe: false },
      { id: 'liked-2', viewId: 'view-2', likeByMe: true },
      { id: 'older-3', viewId: 'view-3', likeByMe: false },
    ] as never);

    const usecase = new ListRecentClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      cursor: '',
      type: 'ALL',
    });

    expect(repo.findRecentClips).toHaveBeenCalledWith({
      userId: 'user-id',
      cursor: undefined,
      limit: 20,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
    });
    expect(result.items.map((item) => item.id)).toEqual([
      'recent-1',
      'liked-2',
      'older-3',
    ]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('커서가 유효하지 않으면 NOT_FOUND를 반환한다', async () => {
    const repo = createRepository();
    repo.isRecentCursorMatchingQuery.mockResolvedValue(false);

    const usecase = new ListRecentClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        cursor: 'view-1',
        type: 'ALL',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('유효한 커서로 단일 최신순 조회를 이어간다', async () => {
    const repo = createRepository();
    repo.isRecentCursorMatchingQuery.mockResolvedValue(true);
    repo.findRecentClips.mockResolvedValue([
      { id: 'after-cursor', viewId: 'view-2', likeByMe: true },
    ] as never);

    const usecase = new ListRecentClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      cursor: 'view-1',
      type: 'TEXT',
    });

    expect(repo.findRecentClips).toHaveBeenCalledWith({
      userId: 'user-id',
      cursor: 'view-1',
      limit: 20,
      type: 'TEXT',
      q: undefined,
      searchTarget: undefined,
    });
    expect(result.items.map((item) => item.id)).toEqual(['after-cursor']);
  });
});
