import { AuthProvider } from '@prisma/client';

export type OAuthMode = 'login' | 'link';
export type AuthPlatform = 'WEB' | 'APP';

export type OAuthUser = {
  provider: AuthProvider;
  providerUserId: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  mode: OAuthMode;
  platform: AuthPlatform;
  currentUserId?: string; // link일 때만
};

export type JwtPayload = {
  sub: string;
  accountId: string;
  platform: AuthPlatform;
};
