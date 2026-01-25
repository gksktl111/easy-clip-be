import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReorderFolderDto {
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  afterId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  beforeId?: string;
}
