import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: '잘못된 요청입니다.' })
  message: string;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiPropertyOptional({ example: 'CLIP_LIMIT_EXCEEDED' })
  code?: string;

  @ApiPropertyOptional({
    example: {
      resource: 'clips',
      folderId: 'folder-id',
      limit: 50,
      currentCount: 50,
      requestedIncrease: 1,
      upgradeCanResolve: true,
    },
  })
  details?: Record<string, unknown>;
}
