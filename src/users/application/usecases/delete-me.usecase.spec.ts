/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteMeUseCase } from './delete-me.usecase';
import { UsersRepository } from '../../domain/users.repository';

const createRepository = (): jest.Mocked<UsersRepository> => ({
  findUserById: jest.fn(),
  findUserWithAuthAccounts: jest.fn(),
  updateAuthAccountProfile: jest.fn(),
  upsertUserSettings: jest.fn(),
  hasOwnedTeamWorkspace: jest.fn(),
  deleteUserAndOwnedPersonalWorkspaces: jest.fn(),
});

describe('DeleteMeUseCase', () => {
  it('사용자가 없으면 NOT_FOUND 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue(null);

    const usecase = new DeleteMeUseCase(repo);

    await expect(usecase.execute('missing-user')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('팀 워크스페이스 OWNER면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue({ id: 'user-id' });
    repo.hasOwnedTeamWorkspace.mockResolvedValue(true);

    const usecase = new DeleteMeUseCase(repo);

    await expect(usecase.execute('user-id')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    expect(repo.deleteUserAndOwnedPersonalWorkspaces).not.toHaveBeenCalled();
  });

  it('탈퇴 처리 시 개인 워크스페이스와 유저를 삭제한다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue({ id: 'user-id' });
    repo.hasOwnedTeamWorkspace.mockResolvedValue(false);

    const usecase = new DeleteMeUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.deleteUserAndOwnedPersonalWorkspaces).toHaveBeenCalledWith(
      'user-id',
    );
    expect(result).toEqual({ success: true });
  });
});
