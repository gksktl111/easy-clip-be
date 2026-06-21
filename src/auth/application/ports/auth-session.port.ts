import type { AuthContext } from 'src/shared/types/auth-context.type';
import type { AuthPlatform } from 'src/shared/types/auth-platform.type';
import type { AuthSessionMetadata } from 'src/shared/types/auth-session-metadata.type';

export const AUTH_SESSION_PORT = Symbol('AUTH_SESSION_PORT');

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
};

export type RefreshTokenSession = {
  sessionId: string;
  tokenHash: string;
  revokedAt: Date | null;
  expiresAt: Date;
};

export interface AuthSessionPort {
  issueTokens(
    context: AuthContext,
    metadata?: AuthSessionMetadata,
  ): Promise<IssuedTokens>;
  signAccessToken(context: AuthContext): string;
  findRefreshTokenSession(
    sessionId: string,
  ): Promise<RefreshTokenSession | null>;
  rotateRefreshToken(
    context: AuthContext & { sessionId: string },
    expectedTokenHash: string,
    metadata?: AuthSessionMetadata,
  ): Promise<IssuedTokens | null>;
  touchRefreshTokenSession(
    sessionId: string,
    metadata?: AuthSessionMetadata,
  ): Promise<void>;
  revokeRefreshTokenSession(sessionId: string): Promise<void>;
  revokeRefreshTokens(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<void>;
}
