import type { AuthProvider as PrismaAuthProvider } from '@prisma/client';
import type { AuthProvider } from 'src/shared/types/auth-provider.type';
import type { AuthAccount } from '../../domain/auth-account.entity';

type AuthAccountRecord = {
  id: string;
  userId: string;
  provider: PrismaAuthProvider;
  providerUserId: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
};

export function toAuthAccount(account: AuthAccountRecord): AuthAccount {
  return {
    id: account.id,
    userId: account.userId,
    provider: account.provider as AuthProvider,
    providerUserId: account.providerUserId,
    email: account.email,
    displayName: resolveDisplayName(account.displayName, account.email),
    profileImageUrl: account.profileImageUrl,
  };
}

export function resolveDisplayName(
  displayName: string | undefined | null,
  email: string,
): string {
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
