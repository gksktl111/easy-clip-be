import type { UsersRepository } from '../domain/users.repository';

export const createUsersRepositoryMock = (): jest.Mocked<UsersRepository> => ({
  findUserById: jest.fn(),
  findUserWithAuthAccounts: jest.fn(),
  updateAuthAccountProfile: jest.fn(),
  upsertUserSettings: jest.fn(),
  deleteUserAndOwnedPersonalWorkspaces: jest.fn(),
});
