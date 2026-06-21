/* eslint-disable @typescript-eslint/unbound-method */
import { LinkAccountUseCase } from './link-account.usecase';
import type { AuthRepository } from '../../domain/auth.repository';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { OAuthUser } from '../../domain/auth.types';

const createRepository = (): jest.Mocked<AuthRepository> => ({
  findAccountByProvider: jest.fn(),
  findAccountById: jest.fn(),
  findUserById: jest.fn(),
  findUserByAuthEmail: jest.fn(),
  createUserWithAuthAccount: jest.fn(),
  createAuthAccountForUser: jest.fn(),
});

const createSessionPort = (): jest.Mocked<AuthSessionPort> => ({
  issueTokens: jest.fn(),
  signAccessToken: jest.fn(),
  findRefreshTokenSession: jest.fn(),
  rotateRefreshToken: jest.fn(),
  touchRefreshTokenSession: jest.fn(),
  revokeRefreshTokenSession: jest.fn(),
  revokeRefreshTokens: jest.fn(),
});

const createOAuthUser = (overrides: Partial<OAuthUser> = {}): OAuthUser => ({
  provider: 'GITHUB',
  providerUserId: 'provider-user-id',
  email: 'user@example.com',
  displayName: 'Link User',
  avatarUrl: 'https://example.com/avatar.png',
  mode: 'link',
  platform: 'WEB',
  currentUserId: 'current-user-id',
  ...overrides,
});

describe('LinkAccountUseCase', () => {
  it('로그인이 없으면 FORBIDDEN 오류를 반환한다', async () => {
    const repo = createRepository();
    const sessionPort = createSessionPort();
    const usecase = new LinkAccountUseCase(repo, sessionPort);

    await expect(
      usecase.execute(createOAuthUser({ currentUserId: undefined })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('이메일이 없으면 BAD_REQUEST 오류를 반환한다', async () => {
    const repo = createRepository();
    const sessionPort = createSessionPort();
    const usecase = new LinkAccountUseCase(repo, sessionPort);

    await expect(
      usecase.execute(createOAuthUser({ email: null })),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('사용자가 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    const sessionPort = createSessionPort();
    repo.findUserById.mockResolvedValue(null);

    const usecase = new LinkAccountUseCase(repo, sessionPort);

    await expect(usecase.execute(createOAuthUser())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('이미 연동된 계정이면 CONFLICT 오류를 반환한다', async () => {
    const repo = createRepository();
    const sessionPort = createSessionPort();
    repo.findUserById.mockResolvedValue({ id: 'current-user-id' });
    repo.findAccountByProvider.mockResolvedValue({
      id: 'account-id',
      userId: 'current-user-id',
      provider: 'GITHUB',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: 'Link User',
      profileImageUrl: null,
    });

    const usecase = new LinkAccountUseCase(repo, sessionPort);

    await expect(usecase.execute(createOAuthUser())).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('정상적인 요청이면 계정을 생성하고 토큰을 발급한다', async () => {
    const repo = createRepository();
    const sessionPort = createSessionPort();
    repo.findUserById.mockResolvedValue({ id: 'current-user-id' });
    repo.findAccountByProvider.mockResolvedValue(null);
    repo.createAuthAccountForUser.mockResolvedValue({
      id: 'new-account-id',
      userId: 'current-user-id',
      provider: 'GITHUB',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: 'Link User',
      profileImageUrl: 'https://example.com/avatar.png',
    });
    sessionPort.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const usecase = new LinkAccountUseCase(repo, sessionPort);
    const result = await usecase.execute(createOAuthUser());

    expect(repo.createAuthAccountForUser).toHaveBeenCalledWith(
      'current-user-id',
      expect.objectContaining({
        provider: 'GITHUB',
        providerUserId: 'provider-user-id',
        email: 'user@example.com',
      }),
    );
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'current-user-id',
        displayName: 'Link User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
  });
});
