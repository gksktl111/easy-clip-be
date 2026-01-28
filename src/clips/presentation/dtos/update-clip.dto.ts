import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateClipDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  folderId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;
}
