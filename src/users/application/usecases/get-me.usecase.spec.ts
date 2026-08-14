import { GetMeUseCase } from './get-me.usecase';
import { createUsersRepositoryMock as createRepository } from '../../test-support/create-users-repository-mock';

describe('GetMeUseCase', () => {
  it('사용자가 없으면 NOT_FOUND 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue(null);

    const usecase = new GetMeUseCase(repo);

    await expect(
      usecase.execute('missing-user', 'account-id'),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('계정이 없으면 NOT_FOUND 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue({
      id: 'user-id',
      authAccounts: [
        {
          id: 'other-account',
          provider: 'GOOGLE',
          email: 'test@example.com',
          displayName: 'tester',
          profileImageUrl: 'https://example.com/a.png',
        },
      ],
    });

    const usecase = new GetMeUseCase(repo);

    await expect(
      usecase.execute('user-id', 'account-id'),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('현재 로그인 계정 기준으로 내 프로필을 반환한다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue({
      id: 'user-id',
      authAccounts: [
        {
          id: 'account-id',
          provider: 'GOOGLE',
          email: 'a@example.com',
          displayName: 'name-a',
          profileImageUrl: 'https://example.com/a.png',
        },
        {
          id: 'account-id-2',
          provider: 'GITHUB',
          email: 'b@example.com',
          displayName: 'name-b',
          profileImageUrl: null,
        },
      ],
    });

    const usecase = new GetMeUseCase(repo);
    const result = await usecase.execute('user-id', 'account-id');

    expect(result).toEqual({
      id: 'user-id',
      displayName: 'name-a',
      avatarUrl: 'https://example.com/a.png',
      authAccounts: [
        {
          id: 'account-id',
          provider: 'GOOGLE',
          email: 'a@example.com',
        },
        {
          id: 'account-id-2',
          provider: 'GITHUB',
          email: 'b@example.com',
        },
      ],
    });
  });

  it('displayName이 비어있으면 email 앞부분을 displayName으로 반환한다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue({
      id: 'user-id',
      authAccounts: [
        {
          id: 'account-id',
          provider: 'GOOGLE',
          email: 'fallback-name@example.com',
          displayName: null,
          profileImageUrl: null,
        },
      ],
    });

    const usecase = new GetMeUseCase(repo);
    const result = await usecase.execute('user-id', 'account-id');

    expect(result.displayName).toBe('fallback-name');
  });
});
