import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { FOLDER_NAME_MAX_LENGTH } from '../../application/constants/folder-name.constants';

export class UpdateFolderDto {
  @ApiPropertyOptional({ example: '개인' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(FOLDER_NAME_MAX_LENGTH)
  name?: string;
}
