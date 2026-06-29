import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApplicationExceptionFilter } from 'src/shared/presentation/filters/application-exception.filter';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { ErrorResponseDto } from 'src/shared/presentation/dtos/error-response.dto';
import { AuthContext } from 'src/shared/types/auth-context.type';
import { DeleteAllTrashItemsUseCase } from '../application/usecases/delete-all-trash-items.usecase';
import { DeleteTrashClipUseCase } from '../application/usecases/delete-trash-clip.usecase';
import { DeleteTrashFolderUseCase } from '../application/usecases/delete-trash-folder.usecase';
import { ListTrashClipsUseCase } from '../application/usecases/list-trash-clips.usecase';
import { ListTrashFoldersUseCase } from '../application/usecases/list-trash-folders.usecase';
import { RestoreTrashClipUseCase } from '../application/usecases/restore-trash-clip.usecase';
import { RestoreTrashFolderUseCase } from '../application/usecases/restore-trash-folder.usecase';
import { ListTrashQueryDto } from './dtos/list-trash-query.dto';
import {
  TrashClipListResponseDto,
  TrashClipResponseDto,
  TrashDeleteAllResponseDto,
  TrashDeleteResponseDto,
  TrashFolderListResponseDto,
  TrashFolderResponseDto,
} from './dtos/trash-response.dto';

@Controller('trash')
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Trash')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: '액세스 토큰이 없거나 유효하지 않습니다.',
  type: ErrorResponseDto,
})
export class TrashController {
  constructor(
    private readonly listTrashClipsUseCase: ListTrashClipsUseCase,
    private readonly restoreTrashClipUseCase: RestoreTrashClipUseCase,
    private readonly deleteTrashClipUseCase: DeleteTrashClipUseCase,
    private readonly listTrashFoldersUseCase: ListTrashFoldersUseCase,
    private readonly restoreTrashFolderUseCase: RestoreTrashFolderUseCase,
    private readonly deleteTrashFolderUseCase: DeleteTrashFolderUseCase,
    private readonly deleteAllTrashItemsUseCase: DeleteAllTrashItemsUseCase,
  ) {}

  @Delete()
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 전체 영구 삭제' })
  @ApiOkResponse({
    description: '휴지통 전체 삭제 결과를 반환합니다.',
    type: TrashDeleteAllResponseDto,
  })
  deleteAllTrashItems(@Request() req: { user: AuthContext }) {
    return this.deleteAllTrashItemsUseCase.execute(req.user.userId);
  }

  @Get('clips')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 클립 목록 조회' })
  @ApiOkResponse({
    description: '삭제된 클립 목록을 반환합니다.',
    type: TrashClipListResponseDto,
  })
  getTrashClips(
    @Request() req: { user: AuthContext },
    @Query() query: ListTrashQueryDto,
  ) {
    return this.listTrashClipsUseCase.execute(req.user.userId, query);
  }

  @Patch('clips/:id/restore')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 클립 복구' })
  @ApiParam({ name: 'id', description: '클립 ID' })
  @ApiOkResponse({
    description: '복구된 클립 메타데이터를 반환합니다.',
    type: TrashClipResponseDto,
  })
  @ApiNotFoundResponse({
    description: '휴지통 클립을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: '삭제된 폴더에 속한 클립은 단독으로 복구할 수 없습니다.',
    type: ErrorResponseDto,
  })
  restoreTrashClip(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
  ) {
    return this.restoreTrashClipUseCase.execute(req.user.userId, id);
  }

  @Delete('clips/:id')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 클립 영구 삭제' })
  @ApiParam({ name: 'id', description: '클립 ID' })
  @ApiOkResponse({
    description: '영구 삭제 결과를 반환합니다.',
    type: TrashDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: '휴지통 클립을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  deleteTrashClip(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
  ) {
    return this.deleteTrashClipUseCase.execute(req.user.userId, id);
  }

  @Get('folders')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 폴더 목록 조회' })
  @ApiOkResponse({
    description: '삭제된 폴더 목록을 반환합니다.',
    type: TrashFolderListResponseDto,
  })
  getTrashFolders(
    @Request() req: { user: AuthContext },
    @Query() query: ListTrashQueryDto,
  ) {
    return this.listTrashFoldersUseCase.execute(req.user.userId, query);
  }

  @Patch('folders/:id/restore')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 폴더 복구' })
  @ApiParam({ name: 'id', description: '폴더 ID' })
  @ApiOkResponse({
    description: '복구된 폴더 메타데이터를 반환합니다.',
    type: TrashFolderResponseDto,
  })
  @ApiNotFoundResponse({
    description: '휴지통 폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  restoreTrashFolder(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
  ) {
    return this.restoreTrashFolderUseCase.execute(req.user.userId, id);
  }

  @Delete('folders/:id')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 폴더 영구 삭제' })
  @ApiParam({ name: 'id', description: '폴더 ID' })
  @ApiOkResponse({
    description: '영구 삭제 결과를 반환합니다.',
    type: TrashDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: '휴지통 폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  deleteTrashFolder(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
  ) {
    return this.deleteTrashFolderUseCase.execute(req.user.userId, id);
  }
}
