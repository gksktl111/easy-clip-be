/* eslint-disable @typescript-eslint/unbound-method */
import { LogoutUseCase } from './logout.usecase';
import type { AuthSessionPort } from '../ports/auth-session.port';

const createSessionPort = (): jest.Mocked<AuthSessionPort> => ({
  issueTokens: jest.fn(),
  signAccessToken: jest.fn(),
  findRefreshTokenSession: jest.fn(),
  revokeRefreshTokens: jest.fn(),
});

describe('LogoutUseCase', () => {
  it('리프레시 토큰을 폐기하고 성공을 반환한다', async () => {
    const sessionPort = createSessionPort();
    sessionPort.revokeRefreshTokens.mockResolvedValue();

    const usecase = new LogoutUseCase(sessionPort);
    const result = await usecase.execute('account-id', 'WEB');

    expect(sessionPort.revokeRefreshTokens).toHaveBeenCalledWith(
      'account-id',
      'WEB',
    );
    expect(result).toEqual({ success: true });
  });
});
