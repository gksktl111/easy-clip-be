import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateFolderTagDto {
  @ApiProperty({ example: 'frontend' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
