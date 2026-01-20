import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateUserDto {
  // 이메일 형식을 검증합니다.
  @IsEmail()
  email: string;

  // 요청에서 필드를 생략해도 됩니다.
  @IsOptional()
  // 값이 있으면 문자열인지 검증합니다.
  @IsString()
  name?: string;

  // 요청에서 필드를 생략해도 됩니다.
  @IsOptional()
  // 값이 있으면 URL 형식인지 검증합니다.
  @IsUrl()
  avatarUrl?: string;
}
