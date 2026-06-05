import type { CreateAuthAccountInput } from '../../domain/auth.repository';
import type { OAuthUser } from '../../domain/auth.types';
import { AuthError } from '../errors/auth.error';

export function requireOAuthEmail(oauthUser: OAuthUser): string {
  if (!oauthUser.email) {
    throw new AuthError(
      'BAD_REQUEST',
      'OAuth 이메일 정보를 가져올 수 없습니다.',
    );
  }

  return oauthUser.email;
}

export function toCreateAuthAccountInput(
  oauthUser: OAuthUser,
  email: string,
): CreateAuthAccountInput {
  return {
    provider: oauthUser.provider,
    providerUserId: oauthUser.providerUserId,
    email,
    displayName: oauthUser.displayName ?? undefined,
    profileImageUrl: oauthUser.avatarUrl ?? null,
  };
}
