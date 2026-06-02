import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY } from '../../domain/auth.repository';
import type { AuthRepository } from '../../domain/auth.repository';
import { AUTH_SESSION_PORT } from '../ports/auth-session.port';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { AuthError } from '../errors/auth.error';
import { OAuthSignInResult } from '../auth.types';
import { OAuthUser } from '../../domain/auth.types';
import { issueAuthResult } from '../policies/auth-result.policy';

@Injectable()
export class SignInUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    @Inject(AUTH_SESSION_PORT)
    private readonly authSessionPort: AuthSessionPort,
  ) {}

  async execute(oauthUser: OAuthUser): Promise<OAuthSignInResult> {
    if (!oauthUser.email) {
      throw new AuthError(
        'BAD_REQUEST',
        'OAuth 이메일 정보를 가져올 수 없습니다.',
      );
    }

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

    const userWithSameEmail = await this.authRepository.findUserByAuthEmail(
      oauthUser.email,
    );

    if (userWithSameEmail) {
      throw new AuthError(
        'CONFLICT',
        '이미 가입된 계정이 있습니다. 계정 연결을 사용해주세요.',
      );
    }

    const newAccount = await this.authRepository.createUserWithAuthAccount({
      provider: oauthUser.provider,
      providerUserId: oauthUser.providerUserId,
      email: oauthUser.email,
      displayName: oauthUser.displayName ?? undefined,
      profileImageUrl: oauthUser.avatarUrl ?? null,
    });

    return issueAuthResult(this.authSessionPort, {
      userId: newAccount.userId,
      account: newAccount,
      platform: oauthUser.platform,
    });
  }
}
