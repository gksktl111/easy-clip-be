import type { UserTheme } from '../../domain/user.types';

export type UserSettingsOutput = {
  id: string;
  userId: string;
  theme: UserTheme;
  language: string;
};
