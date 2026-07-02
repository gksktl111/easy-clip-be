import { ApiProperty } from '@nestjs/swagger';

export class ClipTagResponseDto {
  @ApiProperty({ example: 'cmtag123' })
  id: string;

  @ApiProperty({ example: 'backend' })
  name: string;
}

export class ClipResponseDto {
  @ApiProperty({ example: 'cmclip123' })
  id: string;

  @ApiProperty({ enum: ['TEXT', 'COLOR', 'IMAGE'], example: 'TEXT' })
  type: 'TEXT' | 'COLOR' | 'IMAGE';

  @ApiProperty({ example: '회의 메모' })
  title: string;

  @ApiProperty({ example: '정리할 내용', nullable: true })
  textContent: string | null;

  @ApiProperty({ example: '#FFFFFF', nullable: true })
  colorHex: string | null;

  @ApiProperty({ example: 'https://cdn.example.com/image.png', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: 'cmworkspace123' })
  workspaceId: string;

  @ApiProperty({ example: 'cmfolder123' })
  folderId: string;

  @ApiProperty({ example: '2026-06-05T08:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-05T08:10:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: null, nullable: true })
  deletedAt: Date | null;
}

export class ClipListItemResponseDto extends ClipResponseDto {
  @ApiProperty({ example: false })
  likeByMe: boolean;

  @ApiProperty({ type: [ClipTagResponseDto] })
  tags: ClipTagResponseDto[];
}

export class ClipCursorPageResponseDto {
  @ApiProperty({ type: [ClipListItemResponseDto] })
  items: ClipListItemResponseDto[];

  @ApiProperty({ example: true })
  hasMore: boolean;

  @ApiProperty({ example: 'cmclip123', nullable: true })
  nextCursor: string | null;
}

export class RecentViewedClipItemResponseDto extends ClipListItemResponseDto {
  @ApiProperty({ example: 'cmview123' })
  viewId: string;
}

export class RecentViewedClipListResponseDto {
  @ApiProperty({ type: [RecentViewedClipItemResponseDto] })
  items: RecentViewedClipItemResponseDto[];
}

export class LikeClipResponseDto {
  @ApiProperty({ example: true })
  likeByMe: boolean;
}

export class DeleteClipsResponseDto {
  @ApiProperty({ example: 2 })
  deletedCount: number;
}
