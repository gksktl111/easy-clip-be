import { createHash } from 'crypto';
import type { RefreshTokenSession } from '../ports/auth-session.port';
import { AuthError } from '../errors/auth.error';

export function assertRefreshTokenSession(
  session: RefreshTokenSession | null,
): RefreshTokenSession {
  if (!session) {
    throw new AuthError('UNAUTHORIZED', '리프레쉬 세션이 존재하지 않습니다.');
  }

  if (session.revokedAt) {
    throw new AuthError('UNAUTHORIZED', '폐기된 리프레쉬 토큰입니다.');
  }

  if (session.expiresAt < new Date()) {
    throw new AuthError('UNAUTHORIZED', '리프레쉬 토큰이 만료되었습니다.');
  }

  return session;
}

export function assertRefreshTokenMatches(
  refreshToken: string,
  tokenHash: string,
) {
  const incomingHash = createHash('sha256').update(refreshToken).digest('hex');

  if (incomingHash !== tokenHash) {
    throw new AuthError('UNAUTHORIZED', '리프레쉬 토큰이 일치하지 않습니다.');
  }
}
