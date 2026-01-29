import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListClipsQueryDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsIn(['TEXT', 'COLOR', 'IMAGE', 'ALL'])
  type?: 'TEXT' | 'COLOR' | 'IMAGE' | 'ALL';

  @IsOptional()
  @IsString()
  q?: string;
}
