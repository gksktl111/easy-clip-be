import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class TestAdminLoginDto {
  @ApiPropertyOptional({
    enum: ['WEB', 'APP'],
    example: 'WEB',
    description: '발급할 토큰의 플랫폼 컨텍스트',
  })
  @IsOptional()
  @IsIn(['WEB', 'APP'])
  platform?: 'WEB' | 'APP';
}
