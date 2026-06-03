import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY } from '../../domain/auth.repository';
import type { AuthRepository } from '../../domain/auth.repository';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { AuthError } from '../errors/auth.error';
import { OAuthSignInResult } from '../auth.types';
import { AuthPlatform } from 'src/common/types/auth-platform.type';
import { issueAuthResult } from '../policies/auth-result.policy';

@Injectable()
export class SwitchUserUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    @Inject(AUTH_SESSION_PORT)
    private readonly authSessionPort: AuthSessionPort,
  ) {}

  async execute(
    currentUserId: string,
    targetAuthAccountId: string,
    platform: AuthPlatform,
  ): Promise<OAuthSignInResult> {
    const targetAccount =
      await this.authRepository.findAccountById(targetAuthAccountId);

    if (!targetAccount) {
      throw new AuthError('NOT_FOUND', '전환할 계정을 찾을 수 없습니다.');
    }

    if (targetAccount.userId !== currentUserId) {
      throw new AuthError('FORBIDDEN', '연동되지 않은 계정입니다.');
    }

    return issueAuthResult(this.authSessionPort, {
      userId: targetAccount.userId,
      account: targetAccount,
      platform,
    });
  }
}
