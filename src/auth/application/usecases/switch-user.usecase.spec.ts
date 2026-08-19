/* eslint-disable @typescript-eslint/unbound-method */
import { SwitchUserUseCase } from './switch-user.usecase';
import { createAuthRepositoryMock } from '../../test-support/create-auth-repository-mock';
import type { AuthSessionPort } from '../ports/auth-session.port';

const createSessionPort = (): jest.Mocked<AuthSessionPort> => ({
  issueTokens: jest.fn(),
  signAccessToken: jest.fn(),
  findRefreshTokenSession: jest.fn(),
  rotateRefreshToken: jest.fn(),
  touchRefreshTokenSession: jest.fn(),
  revokeRefreshTokenSession: jest.fn(),
  revokeRefreshTokens: jest.fn(),
});

describe('SwitchUserUseCase', () => {
  it('계정이 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    repo.findAccountById.mockResolvedValue(null);

    const usecase = new SwitchUserUseCase(repo, sessionPort);

    await expect(
      usecase.execute('user-id', 'account-id', 'WEB'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('현재 사용자와 계정이 다르면 FORBIDDEN 오류를 반환한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    repo.findAccountById.mockResolvedValue({
      id: 'account-id',
      userId: 'other-user-id',
      provider: 'GOOGLE',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: 'Switch User',
      profileImageUrl: null,
    });

    const usecase = new SwitchUserUseCase(repo, sessionPort);

    await expect(
      usecase.execute('user-id', 'account-id', 'WEB'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('정상적인 요청이면 토큰을 발급한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    repo.findAccountById.mockResolvedValue({
      id: 'account-id',
      userId: 'user-id',
      provider: 'GOOGLE',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: 'Switch User',
      profileImageUrl: 'https://example.com/avatar.png',
    });
    sessionPort.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const usecase = new SwitchUserUseCase(repo, sessionPort);
    const result = await usecase.execute('user-id', 'account-id', 'WEB');

    expect(sessionPort.issueTokens).toHaveBeenCalledWith({
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
