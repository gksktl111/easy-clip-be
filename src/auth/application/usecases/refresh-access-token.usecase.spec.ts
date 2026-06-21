/* eslint-disable @typescript-eslint/unbound-method */
import { createHash } from 'crypto';
import { RefreshAccessTokenUseCase } from './refresh-access-token.usecase';
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

const createHashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const authContext = {
  userId: 'user-id',
  accountId: 'account-id',
  platform: 'WEB' as const,
  sessionId: 'session-id',
};

describe('RefreshAccessTokenUseCase', () => {
  it('세션이 없으면 UNAUTHORIZED 오류를 반환한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.findRefreshTokenSession.mockResolvedValue(null);

    const usecase = new RefreshAccessTokenUseCase(sessionPort);

    await expect(
      usecase.execute(authContext, 'refresh-token'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(sessionPort.findRefreshTokenSession).toHaveBeenCalledWith(
      'session-id',
    );
  });

  it('폐기된 세션이면 UNAUTHORIZED 오류를 반환한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('refresh-token'),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60),
      sessionId: 'session-id',
    });

    const usecase = new RefreshAccessTokenUseCase(sessionPort);

    await expect(
      usecase.execute(authContext, 'refresh-token'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('만료된 세션이면 UNAUTHORIZED 오류를 반환한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('refresh-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000 * 60),
      sessionId: 'session-id',
    });

    const usecase = new RefreshAccessTokenUseCase(sessionPort);

    await expect(
      usecase.execute(authContext, 'refresh-token'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('토큰 해시가 다르면 UNAUTHORIZED 오류를 반환한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('stored-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60),
      sessionId: 'session-id',
    });

    const usecase = new RefreshAccessTokenUseCase(sessionPort);

    await expect(
      usecase.execute(authContext, 'refresh-token'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('임계 구간 밖이면 액세스 토큰만 발급하고 세션 사용 시각을 갱신한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('refresh-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      sessionId: 'session-id',
    });
    sessionPort.signAccessToken.mockReturnValue('access-token');
    sessionPort.touchRefreshTokenSession.mockResolvedValue();

    const usecase = new RefreshAccessTokenUseCase(sessionPort);
    const result = await usecase.execute(authContext, 'refresh-token', {
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    });

    expect(sessionPort.signAccessToken).toHaveBeenCalledWith(authContext);
    expect(sessionPort.touchRefreshTokenSession).toHaveBeenCalledWith(
      'session-id',
      {
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      },
    );
    expect(sessionPort.rotateRefreshToken).not.toHaveBeenCalled();
    expect(result).toEqual({ access_token: 'access-token' });
  });

  it('임계 구간 안이면 액세스 토큰과 리프레시 토큰을 함께 rotation한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('refresh-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      sessionId: 'session-id',
    });
    sessionPort.rotateRefreshToken.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    const usecase = new RefreshAccessTokenUseCase(sessionPort);
    const result = await usecase.execute(authContext, 'refresh-token');

    expect(sessionPort.rotateRefreshToken).toHaveBeenCalledWith(
      authContext,
      createHashToken('refresh-token'),
      undefined,
    );
    expect(sessionPort.signAccessToken).not.toHaveBeenCalled();
    expect(sessionPort.touchRefreshTokenSession).not.toHaveBeenCalled();
    expect(result).toEqual({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    });
  });

  it('rotation 중 저장된 토큰 해시가 바뀌면 UNAUTHORIZED 오류를 반환한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.findRefreshTokenSession.mockResolvedValue({
      tokenHash: createHashToken('refresh-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      sessionId: 'session-id',
    });
    sessionPort.rotateRefreshToken.mockResolvedValue(null);

    const usecase = new RefreshAccessTokenUseCase(sessionPort);

    await expect(
      usecase.execute(authContext, 'refresh-token'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('세션 ID가 없으면 UNAUTHORIZED 오류를 반환한다', async () => {
    const sessionPort = createSessionPort();
    const usecase = new RefreshAccessTokenUseCase(sessionPort);

    await expect(
      usecase.execute(
        { userId: 'user-id', accountId: 'account-id', platform: 'WEB' },
        'refresh-token',
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(sessionPort.findRefreshTokenSession).not.toHaveBeenCalled();
  });
});
