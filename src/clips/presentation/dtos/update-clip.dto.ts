import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateClipDto {
  @ApiPropertyOptional({
    example: '새 이름',
    description: '클립 표시 이름. 단독 변경 시 기존 콘텐츠를 보존합니다.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
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
