import { UserProfile, UserWithAuthAccounts } from '../../domain/user.types';
import { UsersError } from '../errors/users.error';

export function mapMeResponse(
  user: UserWithAuthAccounts,
  accountId: string,
): UserProfile {
  const account = user.authAccounts.find((item) => item.id === accountId);

  if (!account) {
    throw new UsersError('NOT_FOUND', '계정 정보를 찾을 수 없습니다.');
  }

  return {
    id: user.id,
    displayName: resolveDisplayName(account.displayName, account.email),
    avatarUrl: account.profileImageUrl ?? null,
    authAccounts: user.authAccounts.map((item) => ({
      id: item.id,
      provider: item.provider,
      email: item.email,
    })),
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
