import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { AuthContext } from 'src/auth/application/auth-context';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { GetFolderClipsQueryDto } from './dtos/get-folder-clips-query.dto';
import { ReorderFolderDto } from './dtos/reorder-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';
import { FoldersService } from './folders.service';

@Controller('folders')
export class FoldersController {
  constructor(private foldersService: FoldersService) {}

  // 폴더 목록 조회
  @Get()
  @UseGuards(JwtAccessGuard)
  getFolders(@Request() req: { user: AuthContext }) {
    return this.foldersService.getFolders(req.user.userId);
  }

  // 폴더에 속한 클립 목록을 커서 기반으로 조회한다.
  @Get(':id/clips')
  @UseGuards(JwtAccessGuard)
  getFolderClips(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
    @Query() query: GetFolderClipsQueryDto,
  ) {
    return this.foldersService.getFolderClips(req.user.userId, id, query);
  }

  // 폴더 단건 조회
  @Get(':id')
  @UseGuards(JwtAccessGuard)
  getFolder(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.foldersService.getFolderById(req.user.userId, id);
  }

  // 폴더 생성
  @Post()
  @UseGuards(JwtAccessGuard)
  createFolder(
    @Request() req: { user: AuthContext },
    @Body() dto: CreateFolderDto,
  ) {
    console.log('dto', dto);
    return this.foldersService.createFolder(req.user.userId, dto);
  }

  // 폴더 순서 변경
  @Patch('reorder')
  @UseGuards(JwtAccessGuard)
  reorderFolder(
    @Request() req: { user: AuthContext },
    @Body() dto: ReorderFolderDto,
  ) {
    return this.foldersService.reorderFolder(req.user.userId, dto);
  }

  // 폴더 이름 수정
  @Patch(':id')
  @UseGuards(JwtAccessGuard)
  updateFolder(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.updateFolder(req.user.userId, id, dto);
  }

  // 폴더 삭제(소프트 삭제)
  @Delete(':id')
  @UseGuards(JwtAccessGuard)
  deleteFolder(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.foldersService.deleteFolder(req.user.userId, id);
  }
}
