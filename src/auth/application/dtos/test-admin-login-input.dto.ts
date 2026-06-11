import type { AuthPlatform } from 'src/shared/types/auth-platform.type';

export type TestAdminLoginInput = {
  email: string;
  displayName: string;
  platform: AuthPlatform;
  avatarUrl?: string | null;
};
