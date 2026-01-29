/* eslint-disable @typescript-eslint/unbound-method */
import { SignInUseCase } from './sign-in.usecase';
import { AuthRepository } from '../../domain/auth.repository';
import { OAuthUser } from '../../domain/auth.types';

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

const createOAuthUser = (overrides: Partial<OAuthUser> = {}): OAuthUser => ({
  provider: 'GOOGLE',
  providerUserId: 'provider-user-id',
  email: 'user@example.com',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.png',
  mode: 'login',
  platform: 'WEB',
  ...overrides,
});

describe('SignInUseCase', () => {
  it('이메일이 없으면 BAD_REQUEST 오류를 반환한다', async () => {
    const repo = createRepository();
    const usecase = new SignInUseCase(repo);

    await expect(
      usecase.execute(createOAuthUser({ email: null })),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('기존 계정이 있으면 토큰을 발급한다', async () => {
    const repo = createRepository();
    repo.findAccountByProvider.mockResolvedValue({
      id: 'account-id',
      userId: 'user-id',
      provider: 'GOOGLE',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: 'Test User',
      profileImageUrl: 'https://example.com/avatar.png',
    });
    repo.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const usecase = new SignInUseCase(repo);
    const result = await usecase.execute(createOAuthUser());

    expect(repo.issueTokens).toHaveBeenCalledWith({
      userId: 'user-id',
      accountId: 'account-id',
      platform: 'WEB',
    });
    expect(repo.findUserByAuthEmail).not.toHaveBeenCalled();
    expect(repo.createUserWithAuthAccount).not.toHaveBeenCalled();
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-id',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
  });

  it('동일 이메일 사용자가 있으면 CONFLICT 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findAccountByProvider.mockResolvedValue(null);
    repo.findUserByAuthEmail.mockResolvedValue({ id: 'user-id' });

    const usecase = new SignInUseCase(repo);

    await expect(usecase.execute(createOAuthUser())).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('신규 계정이면 계정을 생성하고 토큰을 발급한다', async () => {
    const repo = createRepository();
    repo.findAccountByProvider.mockResolvedValue(null);
    repo.findUserByAuthEmail.mockResolvedValue(null);
    repo.createUserWithAuthAccount.mockResolvedValue({
      id: 'new-account-id',
      userId: 'new-user-id',
      provider: 'GOOGLE',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: null,
      profileImageUrl: null,
    });
    repo.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const usecase = new SignInUseCase(repo);
    const result = await usecase.execute(createOAuthUser());

    expect(repo.createUserWithAuthAccount).toHaveBeenCalled();
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'new-user-id',
        displayName: null,
        avatarUrl: null,
      },
    });
  });
});
