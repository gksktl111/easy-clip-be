import type { AuthProvider } from 'src/common/types/auth-provider.type';

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
