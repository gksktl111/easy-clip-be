/* eslint-disable @typescript-eslint/unbound-method */
import { LikeClipUseCase } from './like-clip.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';

describe('LikeClipUseCase', () => {
  it('클립이 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);

    const usecase = new LikeClipUseCase(repo);

    await expect(usecase.execute('user-id', 'clip-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('좋아요를 등록하고 likeByMe를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({ id: 'clip-id' } as never);

    const usecase = new LikeClipUseCase(repo);
    const result = await usecase.execute('user-id', 'clip-id');

    expect(repo.createClipLike).toHaveBeenCalledWith('user-id', 'clip-id');
    expect(result).toEqual({ likeByMe: true });
  });
});
