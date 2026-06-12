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
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/shared/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/shared/presentation/filters/application-exception.filter';
import { CreateFolderDto } from './dtos/create-folder.dto';
import { ReorderFolderDto } from './dtos/reorder-folder.dto';
import { UpdateFolderDto } from './dtos/update-folder.dto';
import { FolderResponseDto } from './dtos/folder-response.dto';
import { FolderTagResponseDto } from './dtos/folder-tag-response.dto';
import { GetFolderUseCase } from '../application/usecases/get-folder.usecase';
import { ListFoldersUseCase } from '../application/usecases/list-folders.usecase';
import { ReorderFolderUseCase } from '../application/usecases/reorder-folder.usecase';
import { DeleteFolderUseCase } from '../application/usecases/delete-folder.usecase';
import { CreateFolderUseCase } from '../application/usecases/create-folder.usecase';
import { UpdateFolderUseCase } from '../application/usecases/update-folder.usecase';
import { ErrorResponseDto } from 'src/shared/presentation/dtos/error-response.dto';
import { ListFolderTagsUseCase } from '../application/usecases/list-folder-tags.usecase';
import { CreateFolderTagUseCase } from '../application/usecases/create-folder-tag.usecase';
import { UpdateFolderTagUseCase } from '../application/usecases/update-folder-tag.usecase';
import { DeleteFolderTagUseCase } from '../application/usecases/delete-folder-tag.usecase';
import { CreateFolderTagDto } from './dtos/create-folder-tag.dto';
import { UpdateFolderTagDto } from './dtos/update-folder-tag.dto';

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
    private readonly listFolderTagsUseCase: ListFolderTagsUseCase,
    private readonly createFolderTagUseCase: CreateFolderTagUseCase,
    private readonly updateFolderTagUseCase: UpdateFolderTagUseCase,
    private readonly deleteFolderTagUseCase: DeleteFolderTagUseCase,
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

  @Get(':folderId/tags')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 태그 목록 조회' })
  @ApiParam({ name: 'folderId', description: '폴더 ID' })
  @ApiOkResponse({
    description: '폴더에 속한 태그 목록을 반환합니다.',
    type: FolderTagResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description: '폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  getFolderTags(
    @Request() req: { user: AuthContext },
    @Param('folderId') folderId: string,
  ) {
    return this.listFolderTagsUseCase.execute(req.user.userId, folderId);
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
    return this.createFolderUseCase.execute(req.user.userId, dto);
  }

  @Post(':folderId/tags')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 태그 생성' })
  @ApiParam({ name: 'folderId', description: '폴더 ID' })
  @ApiBody({ type: CreateFolderTagDto })
  @ApiOkResponse({
    description: '생성된 태그를 반환합니다.',
    type: FolderTagResponseDto,
  })
  @ApiNotFoundResponse({
    description: '폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  createFolderTag(
    @Request() req: { user: AuthContext },
    @Param('folderId') folderId: string,
    @Body() dto: CreateFolderTagDto,
  ) {
    return this.createFolderTagUseCase.execute(req.user.userId, {
      folderId,
      name: dto.name,
    });
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
    return this.updateFolderUseCase.execute(req.user.userId, {
      folderId: id,
      ...dto,
    });
  }

  @Patch(':folderId/tags/:tagId')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 태그 수정' })
  @ApiParam({ name: 'folderId', description: '폴더 ID' })
  @ApiParam({ name: 'tagId', description: '태그 ID' })
  @ApiBody({ type: UpdateFolderTagDto })
  @ApiOkResponse({
    description: '수정된 태그를 반환합니다.',
    type: FolderTagResponseDto,
  })
  @ApiNotFoundResponse({
    description: '폴더 또는 태그를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  updateFolderTag(
    @Request() req: { user: AuthContext },
    @Param('folderId') folderId: string,
    @Param('tagId') tagId: string,
    @Body() dto: UpdateFolderTagDto,
  ) {
    return this.updateFolderTagUseCase.execute(req.user.userId, {
      folderId,
      tagId,
      name: dto.name,
    });
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

  @Delete(':folderId/tags/:tagId')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '폴더 태그 삭제' })
  @ApiParam({ name: 'folderId', description: '폴더 ID' })
  @ApiParam({ name: 'tagId', description: '태그 ID' })
  @ApiOkResponse({
    description: '태그 삭제가 완료되었습니다.',
  })
  @ApiNotFoundResponse({
    description: '폴더 또는 태그를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  deleteFolderTag(
    @Request() req: { user: AuthContext },
    @Param('folderId') folderId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.deleteFolderTagUseCase.execute(
      req.user.userId,
      folderId,
      tagId,
    );
  }
}
