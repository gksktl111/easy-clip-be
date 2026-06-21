import { Inject, Injectable } from '@nestjs/common';
import { AuthContext } from 'src/shared/types/auth-context.type';
import type { AuthSessionMetadata } from 'src/shared/types/auth-session-metadata.type';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { RefreshAccessTokenOutput } from '../dtos/refresh-access-token-output.dto';
import {
  assertRefreshTokenMatches,
  assertRefreshTokenSession,
} from '../helpers/refresh-token.helper';
import { AuthError } from '../errors/auth.error';

const REFRESH_TOKEN_ROTATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshAccessTokenUseCase {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly authSessionPort: AuthSessionPort,
  ) {}

  async execute(
    context: AuthContext,
    refreshToken: string,
    metadata?: AuthSessionMetadata,
  ): Promise<RefreshAccessTokenOutput> {
    if (!context.sessionId) {
      throw new AuthError('UNAUTHORIZED', '리프레쉬 세션이 존재하지 않습니다.');
    }

    const session = assertRefreshTokenSession(
      await this.authSessionPort.findRefreshTokenSession(context.sessionId),
    );
    assertRefreshTokenMatches(refreshToken, session.tokenHash);

    if (shouldRotateRefreshToken(session.expiresAt)) {
      const tokens = await this.authSessionPort.rotateRefreshToken(
        { ...context, sessionId: context.sessionId },
        session.tokenHash,
        metadata,
      );

      if (!tokens) {
        throw new AuthError(
          'UNAUTHORIZED',
          '리프레쉬 토큰이 일치하지 않습니다.',
        );
      }

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      };
    }

    const accessToken = this.authSessionPort.signAccessToken(context);
    await this.authSessionPort.touchRefreshTokenSession(
      context.sessionId,
      metadata,
    );

    return { access_token: accessToken };
  }
}

function shouldRotateRefreshToken(expiresAt: Date): boolean {
  return (
    expiresAt.getTime() - Date.now() <= REFRESH_TOKEN_ROTATION_THRESHOLD_MS
  );
}
