import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateClipDto {
  @ApiPropertyOptional({ example: 'cmfolder123' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  folderId?: string;

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
