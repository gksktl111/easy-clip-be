/* eslint-disable @typescript-eslint/unbound-method */
import { ApplicationError } from 'src/shared/application/application.error';
import { ListFavoriteClipsUseCase } from './list-favorite-clips.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';

describe('ListFavoriteClipsUseCase', () => {
  it('좋아요된 클립만 조회한다', async () => {
    const repo = createRepository();
    repo.findClips.mockResolvedValue([
      { id: 'fav-1' },
      { id: 'fav-2' },
      { id: 'fav-3' },
    ] as never);

    const usecase = new ListFavoriteClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      cursor: '',
      type: 'ALL',
    });

    expect(repo.findClips).toHaveBeenCalledWith({
      userId: 'user-id',
      cursor: undefined,
      limit: 20,
      type: undefined,
      q: undefined,
      searchTarget: undefined,
      likedOnly: true,
    });
    expect(result.items).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('커서가 좋아요된 클립이 아니면 NOT_FOUND를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({ id: 'clip-id' } as never);
    repo.isClipLikedByUser.mockResolvedValue(false);

    const usecase = new ListFavoriteClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        cursor: 'clip-id',
        type: 'ALL',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('잠긴 폴더의 이전 커서는 접근 범위 밖의 NOT_FOUND로 처리한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockRejectedValue(
      new ApplicationError('FORBIDDEN', '잠긴 폴더입니다.'),
    );
    await expect(
      new ListFavoriteClipsUseCase(repo).execute('user-id', {
        cursor: 'locked-clip',
        type: 'ALL',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repo.findClips).not.toHaveBeenCalled();
  });
});
