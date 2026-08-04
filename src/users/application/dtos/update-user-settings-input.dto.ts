import type { UserLanguage, UserTheme } from '../../domain/user.types';

export type UpdateUserSettingsInput = {
  theme?: UserTheme;
  language?: UserLanguage;
};
