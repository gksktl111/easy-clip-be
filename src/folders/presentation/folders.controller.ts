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
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAccessGuard } from 'src/common/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/common/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/common/presentation/filters/application-exception.filter';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { ReorderFolderDto } from './dtos/reorder-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';
import { FolderResponseDto } from './dtos/folder-response.dto';
import { GetFolderUseCase } from '../application/usecases/get-folder.usecase';
import { ListFoldersUseCase } from '../application/usecases/list-folders.usecase';
import { ReorderFolderUseCase } from '../application/usecases/reorder-folder.usecase';
import { DeleteFolderUseCase } from '../application/usecases/delete-folder.usecase';
import { CreateFolderUseCase } from '../application/usecases/create-folder.usecase';
import { UpdateFolderUseCase } from '../application/usecases/update-folder.usecase';
import { ErrorResponseDto } from 'src/common/presentation/dtos/error-response.dto';

@Controller('folders')
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Folders')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: '액세스 토큰이 없거나 유효하지 않습니다.',
  type: ErrorResponseDto,
})
export class FoldersController {
  constructor(
    private readonly listFoldersUseCase: ListFoldersUseCase,
    private readonly getFolderUseCase: GetFolderUseCase,
    private readonly createFolderUseCase: CreateFolderUseCase,
    private readonly updateFolderUseCase: UpdateFolderUseCase,
    private readonly reorderFolderUseCase: ReorderFolderUseCase,
    private readonly deleteFolderUseCase: DeleteFolderUseCase,
  ) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 목록 조회' })
  @ApiOkResponse({
    description: '개인 워크스페이스의 폴더 목록을 반환합니다.',
    type: FolderResponseDto,
    isArray: true,
  })
  getFolders(@Request() req: { user: AuthContext }) {
    return this.listFoldersUseCase.execute(req.user.userId);
  }

  @Get(':id')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 단건 조회' })
  @ApiParam({ name: 'id', description: '폴더 ID' })
  @ApiOkResponse({
    description: '선택한 폴더를 반환합니다.',
    type: FolderResponseDto,
  })
  @ApiNotFoundResponse({
    description: '폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  getFolder(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.getFolderUseCase.execute(req.user.userId, id);
  }

  @Post()
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 생성' })
  @ApiBody({ type: CreateFolderDto })
  @ApiOkResponse({
    description: '생성된 폴더를 반환합니다.',
    type: FolderResponseDto,
  })
  createFolder(
    @Request() req: { user: AuthContext },
    @Body() dto: CreateFolderDto,
  ) {
    return this.createFolderUseCase.execute(req.user.userId, dto.name);
  }

  @Patch('reorder')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 순서 변경' })
  @ApiBody({ type: ReorderFolderDto })
  @ApiOkResponse({
    description: '정렬이 변경된 대상 폴더를 반환합니다.',
    type: FolderResponseDto,
  })
  @ApiNotFoundResponse({
    description: '대상 폴더 또는 기준 폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  reorderFolder(
    @Request() req: { user: AuthContext },
    @Body() dto: ReorderFolderDto,
  ) {
    return this.reorderFolderUseCase.execute(req.user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 이름 수정' })
  @ApiParam({ name: 'id', description: '폴더 ID' })
  @ApiBody({ type: UpdateFolderDto })
  @ApiOkResponse({
    description: '수정된 폴더를 반환합니다.',
    type: FolderResponseDto,
  })
  @ApiNotFoundResponse({
    description: '폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  updateFolder(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.updateFolderUseCase.execute(req.user.userId, id, dto.name);
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 삭제' })
  @ApiParam({ name: 'id', description: '폴더 ID' })
  @ApiOkResponse({
    description: '소프트 삭제된 폴더를 반환합니다.',
    type: FolderResponseDto,
  })
  @ApiNotFoundResponse({
    description: '폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  deleteFolder(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.deleteFolderUseCase.execute(req.user.userId, id);
  }
}
