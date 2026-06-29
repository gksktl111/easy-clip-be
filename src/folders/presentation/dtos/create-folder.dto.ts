import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { FOLDER_NAME_MAX_LENGTH } from '../../application/constants/folder-name.constants';

export class CreateFolderDto {
  @ApiProperty({ example: '업무' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(FOLDER_NAME_MAX_LENGTH)
  name: string;
}
