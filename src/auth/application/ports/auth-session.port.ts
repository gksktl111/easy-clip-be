import type { AuthContext } from 'src/shared/types/auth-context.type';
import type { AuthPlatform } from 'src/shared/types/auth-platform.type';

export const AUTH_SESSION_PORT = Symbol('AUTH_SESSION_PORT');

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
};

export type RefreshTokenSession = {
  tokenHash: string;
  revokedAt: Date | null;
  expiresAt: Date;
};

export interface AuthSessionPort {
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
