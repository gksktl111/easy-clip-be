import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  TAG_BACKGROUND_COLORS,
  type TagBackgroundColor,
} from 'src/shared/application/tag-background-color.helper';
import { TAG_NAME_MAX_LENGTH } from 'src/shared/application/tag-name.helper';

export class UpdateFolderTagDto {
  @ApiPropertyOptional({
    example: 'frontend',
    description:
      '공백을 포함해 최대 10자이며, 입력한 공백과 대소문자를 그대로 보존합니다.',
  })
  @ValidateIf(
    (dto: UpdateFolderTagDto) =>
      dto.name !== undefined || dto.backgroundColor === undefined,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(TAG_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    enum: TAG_BACKGROUND_COLORS,
    example: 'PURPLE',
    description:
      'GRAY, BROWN, ORANGE, YELLOW, GREEN, BLUE, PURPLE, PINK, RED 중 하나입니다.',
  })
  @ValidateIf(
    (dto: UpdateFolderTagDto) =>
      dto.backgroundColor !== undefined || dto.name === undefined,
  )
  @IsIn(TAG_BACKGROUND_COLORS)
  backgroundColor?: TagBackgroundColor;
}
