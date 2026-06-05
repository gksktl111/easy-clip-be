import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClipDto {
  @ApiProperty({ example: 'cmfolder123' })
  @IsString()
  @IsNotEmpty()
  folderId: string;

  @ApiPropertyOptional({
    example: '회의 메모입니다.',
    description: 'TEXT 또는 COLOR 클립 생성 시 사용합니다.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'IMAGE 클립 생성 시 업로드 파일',
  })
  @Allow()
  file?: unknown;
}
