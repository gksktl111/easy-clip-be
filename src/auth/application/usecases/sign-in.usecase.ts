import { AuthRepository } from '../../domain/auth.repository';
import { AuthContext } from '../auth-context';
import { AuthError } from '../auth.error';
import { OAuthSignInResult } from '../auth.types';
import { OAuthUser } from '../../domain/auth.types';

export class SignInUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

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
      return this.issueAuthResult(
        existingAccount.userId,
        existingAccount,
        oauthUser.platform,
      );
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
      displayName: oauthUser.displayName ?? null,
      profileImageUrl: oauthUser.avatarUrl ?? null,
    });

    return this.issueAuthResult(
      newAccount.userId,
      newAccount,
      oauthUser.platform,
    );
  }

  private async issueAuthResult(
    userId: string,
    account: {
      id: string;
      displayName: string | null;
      profileImageUrl: string | null;
    },
    platform: AuthContext['platform'],
  ): Promise<OAuthSignInResult> {
    const context: AuthContext = {
      userId,
      accountId: account.id,
      platform,
    };

    const tokens = await this.authRepository.issueTokens(context);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: userId,
        displayName: account.displayName ?? null,
        avatarUrl: account.profileImageUrl ?? null,
      },
    };
  }
}
