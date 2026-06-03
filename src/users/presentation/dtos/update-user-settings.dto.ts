import { IsIn, IsOptional } from 'class-validator';
import { USER_THEMES, type UserTheme } from '../../domain/user.types';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsIn(USER_THEMES)
  theme?: UserTheme;

  @IsOptional()
  @IsIn(['ko', 'en'])
  language?: 'ko' | 'en';
}
