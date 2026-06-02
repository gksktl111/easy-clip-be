import { AuthContext } from '../auth-context';
import type { AuthSessionPort } from '../ports/auth-session.port';
import { OAuthSignInResult } from '../auth.types';

export async function issueAuthResult(
  authSessionPort: AuthSessionPort,
  params: {
    userId: string;
    account: {
      id: string;
      email: string;
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

  const tokens = await authSessionPort.issueTokens(context);

  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    user: {
      id: params.userId,
      displayName: resolveDisplayName(
        params.account.displayName,
        params.account.email,
      ),
      avatarUrl: params.account.profileImageUrl,
    },
  };
}

function resolveDisplayName(displayName: string | null, email: string): string {
  const normalizedDisplayName = displayName?.trim();

  if (normalizedDisplayName) {
    return normalizedDisplayName;
  }

  const emailName = email.split('@')[0]?.trim();

  if (emailName) {
    return emailName;
  }

  return '사용자';
}
