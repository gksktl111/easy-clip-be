import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthContext } from '../auth-context';
import { AuthError } from '../errors/auth.error';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { AccessTokenResult } from '../auth.types';

@Injectable()
export class RefreshAccessTokenUseCase {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly authSessionPort: AuthSessionPort,
  ) {}

  async execute(
    context: AuthContext,
    refreshToken: string,
  ): Promise<AccessTokenResult> {
    const { accountId, platform } = context;

    const session = await this.authSessionPort.findRefreshTokenSession(
      accountId,
      platform,
    );

    if (!session) {
      throw new AuthError('UNAUTHORIZED', '리프레쉬 세션이 존재하지 않습니다.');
    }

    if (session.revokedAt) {
      throw new AuthError('UNAUTHORIZED', '폐기된 리프레쉬 토큰입니다.');
    }

    if (session.expiresAt < new Date()) {
      throw new AuthError('UNAUTHORIZED', '리프레쉬 토큰이 만료되었습니다.');
    }

    const incomingHash = createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    if (incomingHash !== session.tokenHash) {
      throw new AuthError('UNAUTHORIZED', '리프레쉬 토큰이 일치하지 않습니다.');
    }

    const accessToken = this.authSessionPort.signAccessToken(context);

    return { access_token: accessToken };
  }
}
