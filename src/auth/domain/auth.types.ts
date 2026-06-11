// src/auth/domain/auth.types.ts
import { AuthPlatform } from 'src/shared/types/auth-platform.type';
import { AuthProvider } from 'src/shared/types/auth-provider.type';

export type OAuthMode = 'login' | 'link';

export type OAuthUser = {
  provider: AuthProvider;
  providerUserId: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  mode: OAuthMode;
  platform: AuthPlatform;
  currentUserId?: string;
};
