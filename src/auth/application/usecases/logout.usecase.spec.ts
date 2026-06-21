/* eslint-disable @typescript-eslint/unbound-method */
import { LogoutUseCase } from './logout.usecase';
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

describe('LogoutUseCase', () => {
  it('현재 세션 ID가 있으면 해당 리프레시 토큰 세션만 폐기한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.revokeRefreshTokenSession.mockResolvedValue();

    const usecase = new LogoutUseCase(sessionPort);
    const result = await usecase.execute('account-id', 'WEB', 'session-id');

    expect(sessionPort.revokeRefreshTokenSession).toHaveBeenCalledWith(
      'session-id',
    );
    expect(sessionPort.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('세션 ID가 없으면 기존 플랫폼 세션 폐기 방식으로 폴백한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.revokeRefreshTokens.mockResolvedValue();

    const usecase = new LogoutUseCase(sessionPort);
    const result = await usecase.execute('account-id', 'WEB');

    expect(sessionPort.revokeRefreshTokens).toHaveBeenCalledWith(
      'account-id',
      'WEB',
    );
    expect(sessionPort.revokeRefreshTokenSession).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
