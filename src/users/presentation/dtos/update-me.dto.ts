import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string | null;
}
