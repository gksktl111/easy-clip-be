import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { TrashItemType } from '../../domain/trash.types';

export class RestoreTrashItemDto {
  @ApiProperty({ enum: ['CLIP', 'FOLDER'], example: 'CLIP' })
  @IsIn(['CLIP', 'FOLDER'])
  itemType: TrashItemType;

  @ApiProperty({ example: 'cmitem123' })
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class RestoreTrashItemsDto {
  @ApiProperty({
    type: [RestoreTrashItemDto],
    minItems: 1,
    uniqueItems: true,
    example: [
      { itemType: 'CLIP', id: 'cmclip123' },
      { itemType: 'FOLDER', id: 'cmfolder123' },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique((item: RestoreTrashItemDto) => `${item.itemType}:${item.id}`)
  @ValidateNested({ each: true })
  @Type(() => RestoreTrashItemDto)
  items: RestoreTrashItemDto[];
}
