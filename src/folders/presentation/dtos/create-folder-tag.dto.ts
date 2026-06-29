import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { FOLDER_TAG_NAME_MAX_LENGTH } from '../../application/constants/folder-name.constants';

export class CreateFolderTagDto {
  @ApiProperty({ example: 'backend' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(FOLDER_TAG_NAME_MAX_LENGTH)
  name: string;
}
