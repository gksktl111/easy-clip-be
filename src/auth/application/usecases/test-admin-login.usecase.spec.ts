/* eslint-disable @typescript-eslint/unbound-method */
import { TestAdminLoginUseCase } from './test-admin-login.usecase';
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

const createAccount = (
  overrides: Partial<{
    id: string;
    userId: string;
    provider: 'GITHUB';
    providerUserId: string;
    email: string;
    displayName: string;
    profileImageUrl: string | null;
  }> = {},
) => ({
  id: 'account-id',
  userId: 'user-id',
  provider: 'GITHUB' as const,
  providerUserId: 'easy-clip-test-admin',
  email: 'admin@easyclip.local',
  displayName: 'Test Admin',
  profileImageUrl: null,
  ...overrides,
});

const createInput = () => ({
  email: 'admin@easyclip.local',
  displayName: 'Test Admin',
  platform: 'WEB' as const,
  accessPolicy: {
    nodeEnv: 'local',
    enabled: true,
    expectedSecret: 'test-admin-secret',
    providedSecret: 'test-admin-secret',
  },
});

describe('TestAdminLoginUseCase', () => {
  it('운영 환경에서는 테스트 관리자 로그인을 거부한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    const usecase = new TestAdminLoginUseCase(repo, sessionPort);

    await expect(
      usecase.execute({
        ...createInput(),
        accessPolicy: {
          ...createInput().accessPolicy,
          nodeEnv: 'production',
        },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.findAccountByProvider).not.toHaveBeenCalled();
  });

  it('feature flag가 꺼져 있으면 테스트 관리자 로그인을 거부한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    const usecase = new TestAdminLoginUseCase(repo, sessionPort);

    await expect(
      usecase.execute({
        ...createInput(),
        accessPolicy: {
          ...createInput().accessPolicy,
          enabled: false,
        },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.findAccountByProvider).not.toHaveBeenCalled();
  });

  it('시크릿이 설정되어 있지 않으면 테스트 관리자 로그인을 거부한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    const usecase = new TestAdminLoginUseCase(repo, sessionPort);

    await expect(
      usecase.execute({
        ...createInput(),
        accessPolicy: {
          ...createInput().accessPolicy,
          expectedSecret: undefined,
        },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.findAccountByProvider).not.toHaveBeenCalled();
  });

  it('요청 시크릿이 없으면 테스트 관리자 로그인을 거부한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    const usecase = new TestAdminLoginUseCase(repo, sessionPort);

    await expect(
      usecase.execute({
        ...createInput(),
        accessPolicy: {
          ...createInput().accessPolicy,
          providedSecret: undefined,
        },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(repo.findAccountByProvider).not.toHaveBeenCalled();
  });

  it('요청 시크릿이 일치하지 않으면 테스트 관리자 로그인을 거부한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    const usecase = new TestAdminLoginUseCase(repo, sessionPort);

    await expect(
      usecase.execute({
        ...createInput(),
        accessPolicy: {
          ...createInput().accessPolicy,
          providedSecret: 'wrong-secret',
        },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(repo.findAccountByProvider).not.toHaveBeenCalled();
  });

  it('기존 테스트 관리자 계정이 있으면 바로 토큰을 발급한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    repo.findAccountByProvider.mockResolvedValue(createAccount());
    sessionPort.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const usecase = new TestAdminLoginUseCase(repo, sessionPort);
    const result = await usecase.execute(createInput());

    expect(repo.findUserByAuthEmail).not.toHaveBeenCalled();
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-id',
        displayName: 'Test Admin',
        avatarUrl: null,
      },
    });
  });

  it('동일 이메일 사용자가 있으면 테스트 관리자 계정을 연결한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    repo.findAccountByProvider.mockResolvedValue(null);
    repo.findUserByAuthEmail.mockResolvedValue({ id: 'user-id' });
    repo.createAuthAccountForUser.mockResolvedValue(createAccount());
    sessionPort.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const usecase = new TestAdminLoginUseCase(repo, sessionPort);
    await usecase.execute({
      ...createInput(),
      platform: 'APP',
    });

    expect(repo.createAuthAccountForUser).toHaveBeenCalledWith('user-id', {
      provider: 'GITHUB',
      providerUserId: 'easy-clip-test-admin',
      email: 'admin@easyclip.local',
      displayName: 'Test Admin',
      profileImageUrl: null,
    });
    expect(repo.createUserWithAuthAccount).not.toHaveBeenCalled();
    expect(sessionPort.issueTokens).toHaveBeenCalledWith({
      userId: 'user-id',
      accountId: 'account-id',
      platform: 'APP',
    });
  });

  it('동일 이메일 사용자가 없으면 테스트 관리자 사용자를 생성한다', async () => {
    const repo = createAuthRepositoryMock();
    const sessionPort = createSessionPort();
    repo.findAccountByProvider.mockResolvedValue(null);
    repo.findUserByAuthEmail.mockResolvedValue(null);
    repo.createUserWithAuthAccount.mockResolvedValue(
      createAccount({
        userId: 'new-user-id',
        profileImageUrl: 'https://example.com/admin.png',
      }),
    );
    sessionPort.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const usecase = new TestAdminLoginUseCase(repo, sessionPort);
    const result = await usecase.execute({
      ...createInput(),
      platform: 'WEB',
      avatarUrl: 'https://example.com/admin.png',
    });

    expect(repo.createUserWithAuthAccount).toHaveBeenCalledWith({
      provider: 'GITHUB',
      providerUserId: 'easy-clip-test-admin',
      email: 'admin@easyclip.local',
      displayName: 'Test Admin',
      profileImageUrl: 'https://example.com/admin.png',
    });
    expect(result.user.id).toBe('new-user-id');
    expect(result.user.avatarUrl).toBe('https://example.com/admin.png');
  });
});
