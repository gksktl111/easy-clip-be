import { AuthProvider } from '@prisma/client';

export type OAuthMode = 'login' | 'link';

export type OAuthUser = {
  provider: AuthProvider;
  providerUserId: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  mode: OAuthMode;
  currentUserId?: string; // link일 때만
};
