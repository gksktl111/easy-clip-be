import { AuthPlatform } from './auth-platform.type';

export type AuthContext = {
  userId: string;
  accountId: string;
  platform: AuthPlatform;
};
