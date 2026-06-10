import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY } from '../../domain/auth.repository';
import type { AuthRepository } from '../../domain/auth.repository';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { AuthError } from '../errors/auth.error';
import { AuthSessionOutput } from '../dtos/auth-session-output.dto';
import { OAuthUser } from '../../domain/auth.types';
import { issueAuthResult } from '../policies/auth-result.policy';
import {
  requireOAuthEmail,
  toCreateAuthAccountInput,
} from '../policies/oauth-account.policy';

@Injectable()
export class SignInUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    @Inject(AUTH_SESSION_PORT)
    private readonly authSessionPort: AuthSessionPort,
  ) {}

  async execute(oauthUser: OAuthUser): Promise<AuthSessionOutput> {
    const email = requireOAuthEmail(oauthUser);

    const existingAccount = await this.authRepository.findAccountByProvider(
      oauthUser.provider,
      oauthUser.providerUserId,
    );

    if (existingAccount) {
      return issueAuthResult(this.authSessionPort, {
        userId: existingAccount.userId,
        account: existingAccount,
        platform: oauthUser.platform,
      });
    }

    const userWithSameEmail =
      await this.authRepository.findUserByAuthEmail(email);

    if (userWithSameEmail) {
      throw new AuthError(
        'CONFLICT',
        '이미 가입된 계정이 있습니다. 계정 연결을 사용해주세요.',
      );
    }

    const newAccount = await this.authRepository.createUserWithAuthAccount(
      toCreateAuthAccountInput(oauthUser, email),
    );

    return issueAuthResult(this.authSessionPort, {
      userId: newAccount.userId,
      account: newAccount,
      platform: oauthUser.platform,
    });
  }
}
