import { AuthProvider } from './auth.types';

export type AuthAccount = {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
};
