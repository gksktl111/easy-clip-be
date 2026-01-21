import { IsNotEmpty, IsString } from 'class-validator';

export class SwitchAccountDto {
  @IsString()
  @IsNotEmpty()
  authAccountId: string;
}
