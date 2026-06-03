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
  UseFilters,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/common/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/common/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/common/presentation/filters/application-exception.filter';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { ReorderFolderDto } from './dtos/reorder-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';
import { GetFolderUseCase } from '../application/usecases/get-folder.usecase';
import { ReorderFolderUseCase } from '../application/usecases/reorder-folder.usecase';
import { DeleteFolderUseCase } from '../application/usecases/delete-folder.usecase';
import { SaveFolderUseCase } from '../application/usecases/save-folder.usecase';

@Controller('folders')
@UseFilters(ApplicationExceptionFilter)
export class FoldersController {
  constructor(
    private readonly getFolderUseCase: GetFolderUseCase,
    private readonly saveFolderUseCase: SaveFolderUseCase,
    private readonly reorderFolderUseCase: ReorderFolderUseCase,
    private readonly deleteFolderUseCase: DeleteFolderUseCase,
  ) {}

  // 폴더 목록 조회
  @Get()
  @UseGuards(JwtAccessGuard)
  getFolders(@Request() req: { user: AuthContext }) {
    return this.getFolderUseCase.execute(req.user.userId, { mode: 'list' });
  }

  // 폴더 단건 조회
  @Get(':id')
  @UseGuards(JwtAccessGuard)
  getFolder(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.getFolderUseCase.execute(req.user.userId, {
      mode: 'single',
      folderId: id,
    });
  }

  // 폴더 생성
  @Post()
  @UseGuards(JwtAccessGuard)
  createFolder(
    @Request() req: { user: AuthContext },
    @Body() dto: CreateFolderDto,
  ) {
    return this.saveFolderUseCase.execute(req.user.userId, {
      mode: 'create',
      ...dto,
    });
  }

  // 폴더 순서 변경
  @Patch('reorder')
  @UseGuards(JwtAccessGuard)
  reorderFolder(
    @Request() req: { user: AuthContext },
    @Body() dto: ReorderFolderDto,
  ) {
    return this.reorderFolderUseCase.execute(req.user.userId, dto);
  }

  // 폴더 이름 수정
  @Patch(':id')
  @UseGuards(JwtAccessGuard)
  updateFolder(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.saveFolderUseCase.execute(req.user.userId, {
      mode: 'update',
      folderId: id,
      ...dto,
    });
  }

  // 폴더 삭제(소프트 삭제)
  @Delete(':id')
  @UseGuards(JwtAccessGuard)
  deleteFolder(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.deleteFolderUseCase.execute(req.user.userId, id);
  }
}
