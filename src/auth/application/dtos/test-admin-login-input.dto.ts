import type { AuthPlatform } from 'src/common/types/auth-platform.type';

export type TestAdminLoginInput = {
  email: string;
  displayName: string;
  platform: AuthPlatform;
  avatarUrl?: string | null;
};
