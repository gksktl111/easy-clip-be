import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateFolderDto {
  @ApiPropertyOptional({ example: '개인' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
