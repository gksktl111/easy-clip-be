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

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'TEXT 클립의 전체 원문 (공백·줄바꿈 보존). 해당하지 않는 값은 null.',
    example: '첫째 줄\n둘째 줄',
  })
  textContent: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'IMAGE 클립의 이미지 URL (기존 클립 응답과 동일). 해당하지 않는 값은 null.',
    example: 'https://cdn.easy-clip.app/clips/example.png',
  })
  imageUrl: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'COLOR 클립의 저장된 색상 코드. 해당하지 않는 값은 null.',
    example: '#12ABEF',
  })
  colorHex: string | null;

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

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'TEXT 클립의 전체 원문 (공백·줄바꿈 보존). 해당하지 않는 값은 null이며 CLIP 항목에만 필수로 존재하고 FOLDER 항목에서는 생략.',
    example: '첫째 줄\n둘째 줄',
  })
  textContent?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'IMAGE 클립의 이미지 URL (기존 클립 응답과 동일). 해당하지 않는 값은 null이며 CLIP 항목에만 필수로 존재하고 FOLDER 항목에서는 생략.',
    example: 'https://cdn.easy-clip.app/clips/example.png',
  })
  imageUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'COLOR 클립의 저장된 색상 코드. 해당하지 않는 값은 null이며 CLIP 항목에만 필수로 존재하고 FOLDER 항목에서는 생략.',
    example: '#12ABEF',
  })
  colorHex?: string | null;

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
