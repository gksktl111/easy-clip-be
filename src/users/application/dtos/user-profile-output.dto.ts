import type { AuthProvider } from 'src/shared/types/auth-provider.type';

export type UserProfileOutput = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  authAccounts: {
    id: string;
    provider: AuthProvider;
    email: string;
  }[];
};
