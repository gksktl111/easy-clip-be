/* eslint-disable @typescript-eslint/unbound-method */
import { LogoutUseCase } from './logout.usecase';
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

describe('LogoutUseCase', () => {
  it('리프레시 토큰을 폐기하고 성공을 반환한다', async () => {
    const repo = createRepository();
    repo.revokeRefreshTokens.mockResolvedValue();

    const usecase = new LogoutUseCase(repo);
    const result = await usecase.execute('account-id', 'WEB');

    expect(repo.revokeRefreshTokens).toHaveBeenCalledWith('account-id', 'WEB');
    expect(result).toEqual({ success: true });
  });
});
