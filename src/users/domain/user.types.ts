import type { AuthProvider } from 'src/common/types/auth-provider.type';

export const USER_THEMES = ['LIGHT', 'DARK', 'SYSTEM'] as const;
export type UserTheme = (typeof USER_THEMES)[number];

export type UserSummary = {
  id: string;
};

export type UserAuthAccount = {
  id: string;
  provider: AuthProvider;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
};

export type UserWithAuthAccounts = {
  id: string;
  authAccounts: UserAuthAccount[];
};

export type UserProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  authAccounts: {
    id: string;
    provider: AuthProvider;
    email: string;
  }[];
};

export type UserSettings = {
  id: string;
  userId: string;
  theme: UserTheme;
  language: string;
};
