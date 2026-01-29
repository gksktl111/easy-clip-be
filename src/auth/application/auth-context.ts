// src/auth/application/auth-context.ts

import { AuthPlatform } from '../domain/auth.types';

export type AuthContext = {
  userId: string;
  accountId: string;
  platform: AuthPlatform;
};
