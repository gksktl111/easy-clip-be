import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: '잘못된 요청입니다.' })
  message: string;

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
