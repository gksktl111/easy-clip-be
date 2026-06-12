/* eslint-disable @typescript-eslint/unbound-method */
import { UpdateMeUseCase } from './update-me.usecase';
import { UsersRepository } from '../../domain/users.repository';

const createRepository = (): jest.Mocked<UsersRepository> => ({
  findUserById: jest.fn(),
  findUserWithAuthAccounts: jest.fn(),
  updateAuthAccountProfile: jest.fn(),
  upsertUserSettings: jest.fn(),
  deleteUserAndOwnedPersonalWorkspaces: jest.fn(),
});

describe('UpdateMeUseCase', () => {
  it('사용자가 없으면 NOT_FOUND 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue(null);

    const usecase = new UpdateMeUseCase(repo);

    await expect(
      usecase.execute('missing-user', 'account-id', {
        displayName: 'new-name',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
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
          profileImageUrl: null,
        },
      ],
    });

    const usecase = new UpdateMeUseCase(repo);

    await expect(
      usecase.execute('user-id', 'account-id', { displayName: 'new-name' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('수정 필드가 없으면 업데이트 없이 현재 프로필을 반환한다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue({
      id: 'user-id',
      authAccounts: [
        {
          id: 'account-id',
          provider: 'GOOGLE',
          email: 'test@example.com',
          displayName: 'tester',
          profileImageUrl: 'https://example.com/a.png',
        },
      ],
    });

    const usecase = new UpdateMeUseCase(repo);
    const result = await usecase.execute('user-id', 'account-id', {});

    expect(repo.updateAuthAccountProfile).not.toHaveBeenCalled();
    expect(result.displayName).toBe('tester');
    expect(result.avatarUrl).toBe('https://example.com/a.png');
  });

  it('displayName이 null이면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue({
      id: 'user-id',
      authAccounts: [
        {
          id: 'account-id',
          provider: 'GOOGLE',
          email: 'test@example.com',
          displayName: 'tester',
          profileImageUrl: 'https://example.com/a.png',
        },
      ],
    });

    const usecase = new UpdateMeUseCase(repo);

    await expect(
      usecase.execute('user-id', 'account-id', { displayName: null }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.updateAuthAccountProfile).not.toHaveBeenCalled();
  });

  it('displayName과 avatarUrl을 수정한다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue({
      id: 'user-id',
      authAccounts: [
        {
          id: 'account-id',
          provider: 'GOOGLE',
          email: 'test@example.com',
          displayName: 'tester',
          profileImageUrl: 'https://example.com/a.png',
        },
      ],
    });
    repo.updateAuthAccountProfile.mockResolvedValue({
      id: 'account-id',
      provider: 'GOOGLE',
      email: 'test@example.com',
      displayName: 'new-name',
      profileImageUrl: null,
    });

    const usecase = new UpdateMeUseCase(repo);
    const result = await usecase.execute('user-id', 'account-id', {
      displayName: 'new-name',
      avatarUrl: null,
    });

    expect(repo.updateAuthAccountProfile).toHaveBeenCalledWith('account-id', {
      displayName: 'new-name',
      profileImageUrl: null,
    });
    expect(result.displayName).toBe('new-name');
    expect(result.avatarUrl).toBeNull();
  });

  it('avatarUrl만 수정하면 displayName은 변경하지 않는다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue({
      id: 'user-id',
      authAccounts: [
        {
          id: 'account-id',
          provider: 'GOOGLE',
          email: 'test@example.com',
          displayName: 'tester',
          profileImageUrl: 'https://example.com/a.png',
        },
      ],
    });
    repo.updateAuthAccountProfile.mockResolvedValue({
      id: 'account-id',
      provider: 'GOOGLE',
      email: 'test@example.com',
      displayName: 'tester',
      profileImageUrl: null,
    });

    const usecase = new UpdateMeUseCase(repo);
    const result = await usecase.execute('user-id', 'account-id', {
      avatarUrl: null,
    });

    expect(repo.updateAuthAccountProfile).toHaveBeenCalledWith('account-id', {
      profileImageUrl: null,
    });
    expect(result.displayName).toBe('tester');
    expect(result.avatarUrl).toBeNull();
  });

  it('displayName이 비어있는 계정은 avatar만 수정해도 fallback displayName을 반환한다', async () => {
    const repo = createRepository();
    repo.findUserWithAuthAccounts.mockResolvedValue({
      id: 'user-id',
      authAccounts: [
        {
          id: 'account-id',
          provider: 'GOOGLE',
          email: 'fallback-name@example.com',
          displayName: null,
          profileImageUrl: 'https://example.com/a.png',
        },
      ],
    });
    repo.updateAuthAccountProfile.mockResolvedValue({
      id: 'account-id',
      provider: 'GOOGLE',
      email: 'fallback-name@example.com',
      displayName: null,
      profileImageUrl: null,
    });

    const usecase = new UpdateMeUseCase(repo);
    const result = await usecase.execute('user-id', 'account-id', {
      avatarUrl: null,
    });

    expect(result.displayName).toBe('fallback-name');
    expect(result.avatarUrl).toBeNull();
  });
});
