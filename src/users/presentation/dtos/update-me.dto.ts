import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DISPLAY_NAME_MAX_LENGTH } from '../../application/constants/user-profile.constants';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: '홍길동' })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'https://avatars.githubusercontent.com/u/1?v=4',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string | null;
}
