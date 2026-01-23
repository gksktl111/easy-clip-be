import { IsNotEmpty, IsString } from 'class-validator';

export class SwitchUserDto {
  @IsString()
  @IsNotEmpty()
  authAccountId: string;
}
