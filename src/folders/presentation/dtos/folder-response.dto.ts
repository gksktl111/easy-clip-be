import { ApiProperty } from '@nestjs/swagger';

export class FolderResponseDto {
  @ApiProperty({ example: 'cmfolder123' })
  id: string;

  @ApiProperty({ example: '업무' })
  name: string;

  @ApiProperty({ example: 1.5 })
  order: number;

  @ApiProperty({ example: 'cmworkspace123' })
  workspaceId: string;

  @ApiProperty({ example: '2026-06-05T08:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-05T08:10:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: null, nullable: true })
  deletedAt: Date | null;
}
