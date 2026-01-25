import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access-token.guard';
import { JwtPayload } from 'src/auth/auth';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { ReorderFolderDto } from './dtos/reorder-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';
import { FoldersService } from './folders.service';

@Controller('folders')
export class FoldersController {
  constructor(private foldersService: FoldersService) {}

  // 폴더 목록 조회
  @Get()
  @UseGuards(JwtAccessGuard)
  getFolders(@Request() req: { user: JwtPayload }) {
    return this.foldersService.getFolders(req.user.sub);
  }

  // 폴더 단건 조회
  @Get(':id')
  @UseGuards(JwtAccessGuard)
  getFolder(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.foldersService.getFolderById(req.user.sub, id);
  }

  // 폴더 생성
  @Post()
  @UseGuards(JwtAccessGuard)
  createFolder(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.createFolder(req.user.sub, dto);
  }

  // 폴더 순서 변경
  @Patch('reorder')
  @UseGuards(JwtAccessGuard)
  reorderFolder(
    @Request() req: { user: JwtPayload },
    @Body() dto: ReorderFolderDto,
  ) {
    return this.foldersService.reorderFolder(req.user.sub, dto);
  }

  // 폴더 이름 수정
  @Patch(':id')
  @UseGuards(JwtAccessGuard)
  updateFolder(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.updateFolder(req.user.sub, id, dto);
  }

  // 폴더 삭제(소프트 삭제)
  @Delete(':id')
  @UseGuards(JwtAccessGuard)
  deleteFolder(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.foldersService.deleteFolder(req.user.sub, id);
  }
}
