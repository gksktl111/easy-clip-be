import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY } from '../../domain/auth.repository';
import type { AuthRepository } from '../../domain/auth.repository';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import type { AuthSessionMetadata } from 'src/shared/types/auth-session-metadata.type';
import { AuthSessionOutput } from '../dtos/auth-session-output.dto';
import { TestAdminLoginInput } from '../dtos/test-admin-login-input.dto';
import { issueAuthResult } from '../helpers/auth-result.helper';

const TEST_ADMIN_PROVIDER = 'GITHUB';
const TEST_ADMIN_PROVIDER_USER_ID = 'easy-clip-test-admin';

@Injectable()
export class TestAdminLoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    @Inject(AUTH_SESSION_PORT)
    private readonly authSessionPort: AuthSessionPort,
  ) {}

  async execute(
    input: TestAdminLoginInput,
    metadata?: AuthSessionMetadata,
  ): Promise<AuthSessionOutput> {
    const existingAccount = await this.authRepository.findAccountByProvider(
      TEST_ADMIN_PROVIDER,
      TEST_ADMIN_PROVIDER_USER_ID,
    );

    if (existingAccount) {
      return issueAuthResult(this.authSessionPort, {
        userId: existingAccount.userId,
        account: existingAccount,
        platform: input.platform,
        metadata,
      });
    }

    const createAuthAccountInput = {
      provider: TEST_ADMIN_PROVIDER,
      providerUserId: TEST_ADMIN_PROVIDER_USER_ID,
      email: input.email,
      displayName: input.displayName,
      profileImageUrl: input.avatarUrl ?? null,
    } as const;

    const existingUser = await this.authRepository.findUserByAuthEmail(
      input.email,
    );

    const account = existingUser
      ? await this.authRepository.createAuthAccountForUser(
          existingUser.id,
          createAuthAccountInput,
        )
      : await this.authRepository.createUserWithAuthAccount(
          createAuthAccountInput,
        );

    return issueAuthResult(this.authSessionPort, {
      userId: account.userId,
      account,
      platform: input.platform,
      metadata,
    });
  }
}
