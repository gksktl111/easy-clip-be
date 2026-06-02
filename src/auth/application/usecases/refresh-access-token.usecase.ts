import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AUTH_REPOSITORY } from '../../domain/auth.repository';
import type { AuthRepository } from '../../domain/auth.repository';
import { AuthContext } from '../auth-context';
import { AuthError } from '../auth.error';
import { AccessTokenResult } from '../auth.types';

@Injectable()
export class RefreshAccessTokenUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
  ) {}

  async execute(
    context: AuthContext,
    refreshToken: string,
  ): Promise<AccessTokenResult> {
    const { accountId, platform } = context;

    const session = await this.authRepository.findRefreshTokenSession(
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

    const accessToken = this.authRepository.signAccessToken(context);

    return { access_token: accessToken };
  }
}
