import { createHash } from 'crypto';
import { RefreshAccessTokenUseCase } from './refresh-access-token.usecase';
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

const createHashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

describe('RefreshAccessTokenUseCase', () => {
  it('세션이 없으면 UNAUTHORIZED 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findRefreshTokenSession.mockResolvedValue(null);

    const usecase = new RefreshAccessTokenUseCase(repo);

    await expect(
      usecase.execute(
        { userId: 'user-id', accountId: 'account-id', platform: 'WEB' },
        'refresh-token',
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('폐기된 세션이면 UNAUTHORIZED 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('refresh-token'),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    const usecase = new RefreshAccessTokenUseCase(repo);

    await expect(
      usecase.execute(
        { userId: 'user-id', accountId: 'account-id', platform: 'WEB' },
        'refresh-token',
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('만료된 세션이면 UNAUTHORIZED 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('refresh-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000 * 60),
    });

    const usecase = new RefreshAccessTokenUseCase(repo);

    await expect(
      usecase.execute(
        { userId: 'user-id', accountId: 'account-id', platform: 'WEB' },
        'refresh-token',
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('토큰 해시가 다르면 UNAUTHORIZED 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('stored-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    const usecase = new RefreshAccessTokenUseCase(repo);

    await expect(
      usecase.execute(
        { userId: 'user-id', accountId: 'account-id', platform: 'WEB' },
        'refresh-token',
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('정상적인 요청이면 액세스 토큰을 발급한다', async () => {
    const repo = createRepository();
    repo.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('refresh-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    repo.signAccessToken.mockReturnValue('access-token');

    const usecase = new RefreshAccessTokenUseCase(repo);
    const result = await usecase.execute(
      { userId: 'user-id', accountId: 'account-id', platform: 'WEB' },
      'refresh-token',
    );

    expect(repo.signAccessToken).toHaveBeenCalledWith({
      userId: 'user-id',
      accountId: 'account-id',
      platform: 'WEB',
    });
    expect(result).toEqual({ access_token: 'access-token' });
  });
});
