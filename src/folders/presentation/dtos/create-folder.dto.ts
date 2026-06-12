import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ example: '업무' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
