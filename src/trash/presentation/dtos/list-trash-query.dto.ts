import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListTrashQueryDto {
  @ApiPropertyOptional({
    example: 'cmitem123',
    description: '다음 페이지 조회에 사용할 커서',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    description: '페이지 크기. 기본값 20, 최대 100',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
