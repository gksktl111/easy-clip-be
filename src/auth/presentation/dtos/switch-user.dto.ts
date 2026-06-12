import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SwitchUserDto {
  @ApiProperty({
    example: 'cmauth123',
    description: '전환할 OAuth 계정 ID',
  })
  @IsString()
  @IsNotEmpty()
  authAccountId: string;
}
