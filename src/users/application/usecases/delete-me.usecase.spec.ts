/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteMeUseCase } from './delete-me.usecase';
import { createUsersRepositoryMock as createRepository } from '../../test-support/create-users-repository-mock';

describe('DeleteMeUseCase', () => {
  it('사용자가 없으면 NOT_FOUND 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue(null);

    const usecase = new DeleteMeUseCase(repo);

    await expect(usecase.execute('missing-user')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('탈퇴 처리 시 개인 워크스페이스와 유저를 삭제한다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue({ id: 'user-id' });

    const usecase = new DeleteMeUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.deleteUserAndOwnedPersonalWorkspaces).toHaveBeenCalledWith(
      'user-id',
    );
    expect(result).toEqual({ success: true });
  });
});
