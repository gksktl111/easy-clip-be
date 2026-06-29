import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class DeleteClipsDto {
  @ApiProperty({
    type: [String],
    example: ['cmclip123', 'cmclip456'],
    minItems: 1,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  clipIds: string[];
}
