import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: '홍길동' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @ApiPropertyOptional({
    example: 'https://avatars.githubusercontent.com/u/1?v=4',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string | null;
}
