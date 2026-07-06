import { Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { AUTH_REPOSITORY } from '../../domain/auth.repository';
import type { AuthRepository } from '../../domain/auth.repository';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import type { AuthSessionMetadata } from 'src/shared/types/auth-session-metadata.type';
import { AuthSessionOutput } from '../dtos/auth-session-output.dto';
import { TestAdminLoginInput } from '../dtos/test-admin-login-input.dto';
import { issueAuthResult } from '../helpers/auth-result.helper';
import { AuthError } from '../errors/auth.error';

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
    this.assertTestAdminLoginAllowed(input);

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

  private assertTestAdminLoginAllowed(input: TestAdminLoginInput): void {
    const { accessPolicy } = input;
    const expectedSecret = accessPolicy.expectedSecret?.trim();
    const providedSecret = accessPolicy.providedSecret?.trim();

    if (accessPolicy.nodeEnv === 'production') {
      throw new AuthError(
        'FORBIDDEN',
        '운영 환경에서는 테스트 관리자 로그인을 사용할 수 없습니다.',
      );
    }

    if (!accessPolicy.enabled) {
      throw new AuthError(
        'FORBIDDEN',
        '테스트 관리자 로그인이 비활성화되어 있습니다.',
      );
    }

    if (!expectedSecret) {
      throw new AuthError(
        'FORBIDDEN',
        '테스트 관리자 로그인 시크릿이 설정되어 있지 않습니다.',
      );
    }

    if (!providedSecret || !isSameSecret(providedSecret, expectedSecret)) {
      throw new AuthError(
        'UNAUTHORIZED',
        '테스트 관리자 로그인 시크릿이 올바르지 않습니다.',
      );
    }
  }
}

function isSameSecret(providedSecret: string, expectedSecret: string): boolean {
  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(expectedSecret);

  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
