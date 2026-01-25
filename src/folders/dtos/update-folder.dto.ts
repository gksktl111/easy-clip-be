import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
