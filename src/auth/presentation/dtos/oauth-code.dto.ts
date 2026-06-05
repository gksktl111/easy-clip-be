import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OAuthCodeDto {
  @ApiProperty({ example: 'oauth-authorization-code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'pkce-code-verifier' })
  @IsOptional()
  @IsString()
  codeVerifier?: string;
}
