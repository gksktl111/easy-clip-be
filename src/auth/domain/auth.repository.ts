import { AuthAccount } from './auth-account.entity';
import { AuthProvider } from 'src/shared/types/auth-provider.type';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export type CreateAuthAccountInput = {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  displayName?: string;
  profileImageUrl?: string | null;
};

export type UserInfo = {
  id: string;
};

export interface AuthRepository {
  findAccountByProvider(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<AuthAccount | null>;
  findAccountById(accountId: string): Promise<AuthAccount | null>;
  findUserById(userId: string): Promise<UserInfo | null>;
  findUserByAuthEmail(email: string): Promise<UserInfo | null>;
  createUserWithAuthAccount(
    input: CreateAuthAccountInput,
  ): Promise<AuthAccount>;
  createAuthAccountForUser(
    userId: string,
    input: CreateAuthAccountInput,
  ): Promise<AuthAccount>;
}
