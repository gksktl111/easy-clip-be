/* eslint-disable @typescript-eslint/unbound-method */
import { ListRecentClipsUseCase } from './list-recent-clips.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';

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
