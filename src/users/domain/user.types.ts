import { AuthProvider, Theme } from '@prisma/client';

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
  theme: Theme;
  language: string;
};
