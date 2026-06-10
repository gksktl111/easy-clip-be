import { Inject, Injectable } from '@nestjs/common';
import { AuthPlatform } from 'src/common/types/auth-platform.type';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { LogoutOutput } from '../dtos/logout-output.dto';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly authSessionPort: AuthSessionPort,
  ) {}

  async execute(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<LogoutOutput> {
    await this.authSessionPort.revokeRefreshTokens(authAccountId, platform);

    return { success: true };
  }
}
