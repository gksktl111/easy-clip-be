/* eslint-disable @typescript-eslint/unbound-method */
import { UpdateUserSettingsUseCase } from './update-user-settings.usecase';
import { UsersRepository } from '../../domain/users.repository';

const createRepository = (): jest.Mocked<UsersRepository> => ({
  findUserById: jest.fn(),
  findUserWithAuthAccounts: jest.fn(),
  updateAuthAccountProfile: jest.fn(),
  upsertUserSettings: jest.fn(),
  deleteUserAndOwnedPersonalWorkspaces: jest.fn(),
});

describe('UpdateUserSettingsUseCase', () => {
  it('사용자가 없으면 NOT_FOUND 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue(null);

    const usecase = new UpdateUserSettingsUseCase(repo);

    await expect(
      usecase.execute('missing-user', { theme: 'DARK', language: 'en' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('theme/language를 부분 수정한다', async () => {
    const repo = createRepository();
    repo.findUserById.mockResolvedValue({ id: 'user-id' });
    repo.upsertUserSettings.mockResolvedValue({
      id: 'settings-id',
      userId: 'user-id',
      theme: 'DARK',
      language: 'en',
    });

    const usecase = new UpdateUserSettingsUseCase(repo);
    const result = await usecase.execute('user-id', {
      theme: 'DARK',
      language: 'en',
    });

    expect(repo.upsertUserSettings).toHaveBeenCalledWith('user-id', {
      theme: 'DARK',
      language: 'en',
    });
    expect(result.theme).toBe('DARK');
    expect(result.language).toBe('en');
  });
});
