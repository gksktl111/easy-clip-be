import { AuthProvider } from 'src/shared/types/auth-provider.type';

export type AuthAccount = {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  displayName: string;
  profileImageUrl: string | null;
};
