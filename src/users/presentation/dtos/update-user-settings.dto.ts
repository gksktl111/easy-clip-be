import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  USER_LANGUAGES,
  USER_THEMES,
  type UserLanguage,
  type UserTheme,
} from '../../domain/user.types';

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({ enum: USER_THEMES, example: 'LIGHT' })
  @IsOptional()
  @IsIn(USER_THEMES)
  theme?: UserTheme;

  @ApiPropertyOptional({ enum: USER_LANGUAGES, example: 'ko' })
  @IsOptional()
  @IsIn(USER_LANGUAGES)
  language?: UserLanguage;
}
