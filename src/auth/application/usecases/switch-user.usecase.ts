import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY } from '../../domain/auth.repository';
import type { AuthRepository } from '../../domain/auth.repository';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import type { AuthSessionMetadata } from 'src/shared/types/auth-session-metadata.type';
import { AuthError } from '../errors/auth.error';
import { AuthSessionOutput } from '../dtos/auth-session-output.dto';
import { AuthPlatform } from 'src/shared/types/auth-platform.type';
import { issueAuthResult } from '../helpers/auth-result.helper';

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
    metadata?: AuthSessionMetadata,
  ): Promise<AuthSessionOutput> {
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
      metadata,
    });
  }
}
