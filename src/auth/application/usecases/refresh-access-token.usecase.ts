import { Inject, Injectable } from '@nestjs/common';
import { AuthContext } from 'src/common/types/auth-context.type';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { AccessTokenResult } from '../auth.types';
import {
  assertRefreshTokenMatches,
  assertRefreshTokenSession,
} from '../policies/refresh-token.policy';

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

    const session = assertRefreshTokenSession(
      await this.authSessionPort.findRefreshTokenSession(accountId, platform),
    );
    assertRefreshTokenMatches(refreshToken, session.tokenHash);

    const accessToken = this.authSessionPort.signAccessToken(context);

    return { access_token: accessToken };
  }
}
