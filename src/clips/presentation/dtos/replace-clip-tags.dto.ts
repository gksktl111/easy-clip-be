import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { TAG_NAME_MAX_LENGTH } from 'src/shared/application/tag-name.helper';

export class ReplaceClipTagsDto {
  @ApiProperty({
    type: [String],
    example: ['backend', 'New tag'],
    description:
      '클립에 연결할 태그 이름 전체 목록입니다. 현재 폴더에서 정확히 같은 이름의 태그를 재사용하고, 없으면 새 태그를 생성합니다.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(TAG_NAME_MAX_LENGTH, { each: true })
  tags: string[];
}
