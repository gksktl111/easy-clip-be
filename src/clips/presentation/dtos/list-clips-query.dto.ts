import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListClipsQueryDto {
  @ApiPropertyOptional({ example: 'cmfolder123' })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({
    example: 'cmclip123',
    description: '다음 페이지 조회에 사용할 커서',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    enum: ['true'],
    description: '명시한 경우에만 좋아요 목록을 조회합니다.',
  })
  @IsOptional()
  @IsIn(['true'])
  favorite?: 'true';

  @ApiPropertyOptional({
    enum: ['true'],
    description:
      '좋아요 목록을 명시하지 않은 기본 조회는 최근 클립 목록을 반환합니다.',
  })
  @IsOptional()
  @IsIn(['true'])
  recent?: 'true';

  @ApiProperty({
    enum: ['TEXT', 'COLOR', 'IMAGE', 'ALL'],
    example: 'TEXT',
  })
  @IsIn(['TEXT', 'COLOR', 'IMAGE', 'ALL'])
  type: 'TEXT' | 'COLOR' | 'IMAGE' | 'ALL';

  @ApiPropertyOptional({
    example: '회의',
    description: '제목/내용 검색어',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
