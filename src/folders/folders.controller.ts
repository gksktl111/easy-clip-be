import {
  Body,
  Controller,
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

  @Get()
  @UseGuards(JwtAccessGuard)
  getFolders(@Request() req: { user: JwtPayload }) {
    return this.foldersService.getFolders(req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAccessGuard)
  getFolder(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.foldersService.getFolderById(req.user.sub, id);
  }

  @Post()
  @UseGuards(JwtAccessGuard)
  createFolder(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.createFolder(req.user.sub, dto);
  }

  @Patch('reorder')
  @UseGuards(JwtAccessGuard)
  reorderFolder(
    @Request() req: { user: JwtPayload },
    @Body() dto: ReorderFolderDto,
  ) {
    return this.foldersService.reorderFolder(req.user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard)
  updateFolder(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.updateFolder(req.user.sub, id, dto);
  }
}
