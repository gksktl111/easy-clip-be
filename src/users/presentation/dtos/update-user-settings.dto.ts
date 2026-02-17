import { Theme } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @IsOptional()
  @IsIn(['ko', 'en'])
  language?: 'ko' | 'en';
}
