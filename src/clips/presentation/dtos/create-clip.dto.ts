import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClipDto {
  @IsString()
  @IsNotEmpty()
  folderId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;
}
