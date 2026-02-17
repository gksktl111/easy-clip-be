import { AuthRepository } from '../../domain/auth.repository';
import { AuthError } from '../auth.error';
import { OAuthSignInResult } from '../auth.types';
import { OAuthUser } from '../../domain/auth.types';
import { issueAuthResult } from '../policies/auth-result.policy';

export class LinkAccountUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(oauthUser: OAuthUser): Promise<OAuthSignInResult> {
    if (!oauthUser.currentUserId) {
      throw new AuthError('FORBIDDEN', '로그인이 필요합니다.');
    }

    if (!oauthUser.email) {
      throw new AuthError(
        'BAD_REQUEST',
        'OAuth 이메일 정보를 가져올 수 없습니다.',
      );
    }

    const user = await this.authRepository.findUserById(
      oauthUser.currentUserId,
    );

    if (!user) {
      throw new AuthError('NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    const existingAccount = await this.authRepository.findAccountByProvider(
      oauthUser.provider,
      oauthUser.providerUserId,
    );

    if (existingAccount) {
      throw new AuthError('CONFLICT', '이미 연동된 OAuth 계정입니다.');
    }

    const newAccount = await this.authRepository.createAuthAccountForUser(
      oauthUser.currentUserId,
      {
        provider: oauthUser.provider,
        providerUserId: oauthUser.providerUserId,
        email: oauthUser.email,
        displayName: oauthUser.displayName ?? undefined,
        profileImageUrl: oauthUser.avatarUrl ?? null,
      },
    );

    return issueAuthResult(this.authRepository, {
      userId: newAccount.userId,
      account: newAccount,
      platform: oauthUser.platform,
    });
  }
}
