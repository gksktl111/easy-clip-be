import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY } from '../../domain/auth.repository';
import type { AuthRepository } from '../../domain/auth.repository';
import { AuthPlatform } from '../../domain/auth.types';
import { LogoutResult } from '../auth.types';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
  ) {}

  async execute(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<LogoutResult> {
    await this.authRepository.revokeRefreshTokens(authAccountId, platform);

    return { success: true };
  }
}
