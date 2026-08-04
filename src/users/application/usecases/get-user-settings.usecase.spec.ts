/* eslint-disable @typescript-eslint/unbound-method */
import { GetUserSettingsUseCase } from './get-user-settings.usecase';
import { UsersRepository } from '../../domain/users.repository';

const createRepository = (): jest.Mocked<UsersRepository> => ({
  findUserById: jest.fn(),
  findUserWithAuthAccounts: jest.fn(),
  updateAuthAccountProfile: jest.fn(),
  upsertUserSettings: jest.fn(),
  deleteUserAndOwnedPersonalWorkspaces: jest.fn(),
});

describe('GetUserSettingsUseCase', () => {
  it('사용자가 없으면 NOT_FOUND 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue(null);

    const usecase = new GetUserSettingsUseCase(repo);

    await expect(usecase.execute('missing-user')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('설정이 없으면 기본값으로 생성해 반환한다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue({ id: 'user-id' });
    repo.upsertUserSettings.mockResolvedValue({
      id: 'settings-id',
      userId: 'user-id',
      theme: 'LIGHT',
      language: 'ko',
    });

    const usecase = new GetUserSettingsUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.upsertUserSettings).toHaveBeenCalledWith('user-id', {});
    expect(result).toEqual({
      id: 'settings-id',
      userId: 'user-id',
      theme: 'LIGHT',
      language: 'ko',
    });
  });
});
