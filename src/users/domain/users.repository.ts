import {
  UserAuthAccount,
  UserSettings,
  UserSummary,
  UserTheme,
  UserWithAuthAccounts,
} from './user.types';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export type UpdateAuthAccountProfileParams = {
  displayName?: string;
  profileImageUrl?: string | null;
};

export type UpdateUserSettingsParams = {
  theme?: UserTheme;
  language?: string;
};

export interface UsersRepository {
  findUserById(userId: string): Promise<UserSummary | null>;
  findUserWithAuthAccounts(
    userId: string,
  ): Promise<UserWithAuthAccounts | null>;
  updateAuthAccountProfile(
    accountId: string,
    params: UpdateAuthAccountProfileParams,
  ): Promise<UserAuthAccount>;
  upsertUserSettings(
    userId: string,
    params: UpdateUserSettingsParams,
  ): Promise<UserSettings>;
  hasOwnedTeamWorkspace(userId: string): Promise<boolean>;
  deleteUserAndOwnedPersonalWorkspaces(userId: string): Promise<void>;
}
