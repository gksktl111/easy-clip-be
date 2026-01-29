import { AuthContext } from '../auth-context';
import { OAuthSignInResult } from '../auth.types';
import { AuthRepository } from 'src/auth/domain/auth.repository';

export async function issueAuthResult(
  authRepository: AuthRepository,
  params: {
    userId: string;
    account: {
      id: string;
      displayName: string | null;
      profileImageUrl: string | null;
    };
    platform: AuthContext['platform'];
  },
): Promise<OAuthSignInResult> {
  const context: AuthContext = {
    userId: params.userId,
    accountId: params.account.id,
    platform: params.platform,
  };

  const tokens = await authRepository.issueTokens(context);

  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    user: {
      id: params.userId,
      displayName: params.account.displayName,
      avatarUrl: params.account.profileImageUrl,
    },
  };
}
