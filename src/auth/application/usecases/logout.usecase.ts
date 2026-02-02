import { AuthRepository } from '../../domain/auth.repository';
import { AuthPlatform } from '../../domain/auth.types';
import { LogoutResult } from '../auth.types';

export class LogoutUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<LogoutResult> {
    await this.authRepository.revokeRefreshTokens(authAccountId, platform);

    return { success: true };
  }
}
