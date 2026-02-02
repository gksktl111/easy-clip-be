import { AuthContext } from '../application/auth-context';
import { AuthAccount } from './auth-account.entity';
import { AuthPlatform, AuthProvider } from './auth.types';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export type RefreshTokenSession = {
  tokenHash: string;
  revokedAt: Date | null;
  expiresAt: Date;
};

export type CreateAuthAccountInput = {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  displayName?: string | null;
  profileImageUrl?: string | null;
};

export type UserInfo = {
  id: string;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
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
  issueTokens(context: AuthContext): Promise<IssuedTokens>;
  signAccessToken(context: AuthContext): string;
  findRefreshTokenSession(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<RefreshTokenSession | null>;
  revokeRefreshTokens(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<void>;
}
