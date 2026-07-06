import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrashClipResponseDto {
  @ApiProperty({ example: 'cmclip123' })
  id: string;

  @ApiProperty({ example: '삭제된 클립' })
  title: string;

  @ApiProperty({ enum: ['TEXT', 'COLOR', 'IMAGE'], example: 'TEXT' })
  type: 'TEXT' | 'COLOR' | 'IMAGE';

  @ApiProperty({ example: 'cmfolder123' })
  folderId: string;

  @ApiProperty({ example: '2026-06-05T09:00:00.000Z', nullable: true })
  deletedAt: Date | null;
}

export class TrashFolderResponseDto {
  @ApiProperty({ example: 'cmfolder123' })
  id: string;

  @ApiProperty({ example: '삭제된 폴더' })
  name: string;

  @ApiProperty({ example: '2026-06-05T09:00:00.000Z', nullable: true })
  deletedAt: Date | null;
}

export class TrashItemResponseDto {
  @ApiProperty({ enum: ['CLIP', 'FOLDER'], example: 'CLIP' })
  itemType: 'CLIP' | 'FOLDER';

  @ApiProperty({ example: 'cmitem123' })
  id: string;

  @ApiProperty({ example: '2026-06-05T09:00:00.000Z', nullable: true })
  deletedAt: Date | null;

  @ApiPropertyOptional({ example: '삭제된 클립' })
  title?: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'COLOR', 'IMAGE'], example: 'TEXT' })
  type?: 'TEXT' | 'COLOR' | 'IMAGE';

  @ApiPropertyOptional({ example: 'cmfolder123' })
  folderId?: string;

  @ApiPropertyOptional({ example: '삭제된 폴더' })
  name?: string;
}

export class TrashListResponseDto {
  @ApiProperty({ type: [TrashItemResponseDto] })
  items: TrashItemResponseDto[];

  @ApiProperty({ example: 'CLIP:cmclip123', nullable: true })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class TrashRestoreResponseDto {
  @ApiProperty({ example: 2 })
  restoredCount: number;
}

export class TrashDeleteAllResponseDto {
  @ApiProperty({ example: 3 })
  clipsDeleted: number;

  @ApiProperty({ example: 2 })
  foldersDeleted: number;

  @ApiProperty({ example: 5 })
  totalDeleted: number;
}
