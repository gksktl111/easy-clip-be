import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CLIP_TITLE_MAX_LENGTH } from '../../application/constants/clip-title.constants';
import {
  Allow,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateClipDto {
  @ApiPropertyOptional({
    example: '새 이름',
    description:
      '앞뒤 공백 제거 후 1~15자 클립 표시 이름. 단독 변경 시 기존 콘텐츠를 보존합니다.',
    minLength: 1,
    maxLength: CLIP_TITLE_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(CLIP_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    example: '#FF5733',
    description: 'TEXT 또는 COLOR 값 수정 시 사용합니다.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '이미지 클립으로 교체할 파일',
  })
  @Allow()
  file?: unknown;
}
