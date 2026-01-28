import { SwitchUserUseCase } from './switch-user.usecase';
import { AuthRepository } from '../../domain/auth.repository';

const createRepository = (): jest.Mocked<AuthRepository> => ({
  findAccountByProvider: jest.fn(),
  findAccountById: jest.fn(),
  findUserById: jest.fn(),
  findUserByAuthEmail: jest.fn(),
  createUserWithAuthAccount: jest.fn(),
  createAuthAccountForUser: jest.fn(),
  issueTokens: jest.fn(),
  signAccessToken: jest.fn(),
  findRefreshTokenSession: jest.fn(),
  revokeRefreshTokens: jest.fn(),
});

describe('SwitchUserUseCase', () => {
  it('계정이 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findAccountById.mockResolvedValue(null);

    const usecase = new SwitchUserUseCase(repo);

    await expect(
      usecase.execute('user-id', 'account-id', 'WEB'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('현재 사용자와 계정이 다르면 FORBIDDEN 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findAccountById.mockResolvedValue({
      id: 'account-id',
      userId: 'other-user-id',
      provider: 'GOOGLE',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: 'Switch User',
      profileImageUrl: null,
    });

    const usecase = new SwitchUserUseCase(repo);

    await expect(
      usecase.execute('user-id', 'account-id', 'WEB'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('정상적인 요청이면 토큰을 발급한다', async () => {
    const repo = createRepository();
    repo.findAccountById.mockResolvedValue({
      id: 'account-id',
      userId: 'user-id',
      provider: 'GOOGLE',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: 'Switch User',
      profileImageUrl: 'https://example.com/avatar.png',
    });
    repo.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const usecase = new SwitchUserUseCase(repo);
    const result = await usecase.execute('user-id', 'account-id', 'WEB');

    expect(repo.issueTokens).toHaveBeenCalledWith({
      userId: 'user-id',
      accountId: 'account-id',
      platform: 'WEB',
    });
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-id',
        displayName: 'Switch User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
  });
});
