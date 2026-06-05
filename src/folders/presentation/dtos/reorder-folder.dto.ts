import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReorderFolderDto {
  @ApiProperty({ example: 'cmfolder-target' })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiPropertyOptional({ example: 'cmfolder-after' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  afterId?: string;

  @ApiPropertyOptional({ example: 'cmfolder-before' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  beforeId?: string;
}
