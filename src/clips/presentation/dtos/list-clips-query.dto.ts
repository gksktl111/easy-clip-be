import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListClipsQueryDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsString()
  cursor: string;

  @IsOptional()
  @IsIn(['true'])
  favorite?: 'true';

  @IsOptional()
  @IsIn(['true'])
  recent?: 'true';

  @IsIn(['TEXT', 'COLOR', 'IMAGE', 'ALL'])
  type: 'TEXT' | 'COLOR' | 'IMAGE' | 'ALL';

  @IsOptional()
  @IsString()
  q?: string;
}
