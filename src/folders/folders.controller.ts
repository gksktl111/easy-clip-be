import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access-token.guard';
import { JwtPayload } from 'src/auth/auth';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { FoldersService } from './folders.service';

@Controller('folders')
export class FoldersController {
  constructor(private foldersService: FoldersService) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  getFolders(@Request() req: { user: JwtPayload }) {
    return this.foldersService.getFolders(req.user.sub);
  }

  @Post()
  @UseGuards(JwtAccessGuard)
  createFolder(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.createFolder(req.user.sub, dto);
  }
}
