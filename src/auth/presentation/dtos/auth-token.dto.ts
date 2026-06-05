import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthTokenDto {
  @ApiProperty({ example: 'access-token-value' })
  accessToken: string;

  @ApiPropertyOptional({ example: 'refresh-token-value' })
  refreshToken?: string;

  @ApiPropertyOptional({ example: 3600 })
  expiresIn?: number;
}
