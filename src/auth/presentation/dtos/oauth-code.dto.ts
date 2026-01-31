import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OAuthCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  codeVerifier?: string;
}
