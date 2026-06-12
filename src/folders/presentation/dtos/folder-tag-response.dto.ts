import { ApiProperty } from '@nestjs/swagger';

export class FolderTagResponseDto {
  @ApiProperty({ example: 'cmtag123' })
  id: string;

  @ApiProperty({ example: 'backend' })
  name: string;

  @ApiProperty({ example: 'cmfolder123' })
  folderId: string;
}
