import type { UserTheme } from '../../domain/user.types';

export type UpdateUserSettingsInput = {
  theme?: UserTheme;
  language?: string;
};
