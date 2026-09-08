import { ApiProperty } from '@nestjs/swagger';
import {
  TAG_BACKGROUND_COLORS,
  type TagBackgroundColor,
} from 'src/shared/application/tag-background-color.helper';

export class FolderTagResponseDto {
  @ApiProperty({ example: 'cmtag123' })
  id: string;

  @ApiProperty({ example: 'backend' })
  name: string;

  @ApiProperty({ enum: TAG_BACKGROUND_COLORS, example: 'GRAY' })
  backgroundColor: TagBackgroundColor;

  @ApiProperty({ example: 'cmfolder123' })
  folderId: string;
}
