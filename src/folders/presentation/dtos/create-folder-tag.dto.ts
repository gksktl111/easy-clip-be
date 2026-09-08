import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  TAG_BACKGROUND_COLORS,
  type TagBackgroundColor,
} from 'src/shared/application/tag-background-color.helper';
import { TAG_NAME_MAX_LENGTH } from 'src/shared/application/tag-name.helper';

export class CreateFolderTagDto {
  @ApiProperty({
    example: 'backend',
    description:
      '공백을 포함해 최대 10자이며, 입력한 공백과 대소문자를 그대로 보존합니다.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(TAG_NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional({
    enum: TAG_BACKGROUND_COLORS,
    example: 'ORANGE',
    default: 'GRAY',
    description: '생략하면 GRAY로 저장됩니다.',
  })
  @IsOptional()
  @IsIn(TAG_BACKGROUND_COLORS)
  backgroundColor?: TagBackgroundColor;
}
