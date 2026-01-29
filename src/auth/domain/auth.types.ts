// src/auth/domain/auth.types.ts
export const AuthProvider = {
  GOOGLE: 'GOOGLE',
  GITHUB: 'GITHUB',
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

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
  currentUserId?: string;
};
