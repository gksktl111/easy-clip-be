import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { USER_THEMES, type UserTheme } from '../../domain/user.types';

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({ enum: USER_THEMES, example: 'SYSTEM' })
  @IsOptional()
  @IsIn(USER_THEMES)
  theme?: UserTheme;

  @ApiPropertyOptional({ enum: ['ko', 'en'], example: 'ko' })
  @IsOptional()
  @IsIn(['ko', 'en'])
  language?: 'ko' | 'en';
}
