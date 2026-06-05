import { ApiProperty } from '@nestjs/swagger';

export class UserAuthAccountResponseDto {
  @ApiProperty({ example: 'cmauth123' })
  id: string;

  @ApiProperty({ enum: ['GOOGLE', 'GITHUB'], example: 'GOOGLE' })
  provider: 'GOOGLE' | 'GITHUB';

  @ApiProperty({ example: 'user@example.com' })
  email: string;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: 'cmuser123' })
  id: string;

  @ApiProperty({ example: '홍길동' })
  displayName: string;

  @ApiProperty({
    example: 'https://avatars.githubusercontent.com/u/1?v=4',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ type: [UserAuthAccountResponseDto] })
  authAccounts: UserAuthAccountResponseDto[];
}

export class UserSettingsResponseDto {
  @ApiProperty({ example: 'cmsettings123' })
  id: string;

  @ApiProperty({ example: 'cmuser123' })
  userId: string;

  @ApiProperty({ enum: ['LIGHT', 'DARK', 'SYSTEM'], example: 'SYSTEM' })
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';

  @ApiProperty({ example: 'ko' })
  language: string;
}

export class DeleteMeResponseDto {
  @ApiProperty({ example: true })
  success: true;
}
