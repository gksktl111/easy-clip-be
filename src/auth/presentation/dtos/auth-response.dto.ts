import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ example: 'cmauthuser123' })
  id: string;

  @ApiProperty({ example: '홍길동' })
  displayName: string;

  @ApiProperty({
    example: 'https://avatars.githubusercontent.com/u/1?v=4',
    nullable: true,
  })
  avatarUrl: string | null;
}

export class AuthSignInResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'refresh-token-value' })
  refresh_token: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

export class RefreshAccessTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success: true;
}
