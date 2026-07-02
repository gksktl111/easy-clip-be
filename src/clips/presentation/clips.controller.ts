import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/shared/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/shared/presentation/filters/application-exception.filter';
import { CreateClipDto } from './dtos/create-clip.dto';
import { DeleteClipsDto } from './dtos/delete-clips.dto';
import { ListClipsQueryDto } from './dtos/list-clips-query.dto';
import { UpdateClipDto } from './dtos/update-clip.dto';
import type { MulterFile } from 'src/shared/types/multer-file.type';
import {
  ClipCursorPageResponseDto,
  ClipResponseDto,
  DeleteClipsResponseDto,
  LikeClipResponseDto,
  RecentViewedClipListResponseDto,
} from './dtos/clip-response.dto';
import { DeleteClipUseCase } from '../application/usecases/delete-clip.usecase';
import { DeleteAllClipsUseCase } from '../application/usecases/delete-all-clips.usecase';
import { DeleteClipsUseCase } from '../application/usecases/delete-clips.usecase';
import { CreateClipUseCase } from '../application/usecases/create-clip.usecase';
import { UpdateClipUseCase } from '../application/usecases/update-clip.usecase';
import { ListFolderClipsUseCase } from '../application/usecases/list-folder-clips.usecase';
import { ListFavoriteClipsUseCase } from '../application/usecases/list-favorite-clips.usecase';
import { ListRecentClipsUseCase } from '../application/usecases/list-recent-clips.usecase';
import { LikeClipUseCase } from '../application/usecases/like-clip.usecase';
import { UnlikeClipUseCase } from '../application/usecases/unlike-clip.usecase';
import { RecordClipViewUseCase } from '../application/usecases/record-clip-view.usecase';
import { ListRecentViewedClipsUseCase } from '../application/usecases/list-recent-viewed-clips.usecase';
import { ClipsError } from '../application/errors/clips.error';
import { ErrorResponseDto } from 'src/shared/presentation/dtos/error-response.dto';

@Controller('clips')
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Clips')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: '액세스 토큰이 없거나 유효하지 않습니다.',
  type: ErrorResponseDto,
})
export class ClipsController {
  constructor(
    private readonly createClipUseCase: CreateClipUseCase,
    private readonly updateClipUseCase: UpdateClipUseCase,
    private readonly deleteClipUseCase: DeleteClipUseCase,
    private readonly deleteAllClipsUseCase: DeleteAllClipsUseCase,
    private readonly deleteClipsUseCase: DeleteClipsUseCase,
    private readonly listFolderClipsUseCase: ListFolderClipsUseCase,
    private readonly listFavoriteClipsUseCase: ListFavoriteClipsUseCase,
    private readonly listRecentClipsUseCase: ListRecentClipsUseCase,
    private readonly likeClipUseCase: LikeClipUseCase,
    private readonly unlikeClipUseCase: UnlikeClipUseCase,
    private readonly recordClipViewUseCase: RecordClipViewUseCase,
    private readonly listRecentViewedClipsUseCase: ListRecentViewedClipsUseCase,
  ) {}

  @Get()
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '클립 목록 조회' })
  @ApiQuery({ name: 'folderId', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'favorite', required: false, enum: ['true'] })
  @ApiQuery({ name: 'recent', required: false, enum: ['true'] })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['TEXT', 'COLOR', 'IMAGE', 'ALL'],
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({
    description:
      '폴더, 좋아요, 최근 기준의 커서 페이지네이션 결과를 반환합니다.',
    type: ClipCursorPageResponseDto,
  })
  getClips(
    @Request() req: { user: AuthContext },
    @Query() query: ListClipsQueryDto,
  ) {
    const favorite = query.favorite === 'true';
    const recent = query.recent === 'true';

    if (!query.type) {
      throw new ClipsError('BAD_REQUEST', '잘못된 요청입니다.');
    }

    if (query.folderId) {
      if (favorite || recent) {
        throw new ClipsError('BAD_REQUEST', '잘못된 요청입니다.');
      }

      return this.listFolderClipsUseCase.execute(req.user.userId, {
        folderId: query.folderId,
        cursor: query.cursor,
        type: query.type,
        q: query.q,
      });
    }

    if (favorite === recent) {
      throw new ClipsError('BAD_REQUEST', '잘못된 요청입니다.');
    }

    if (favorite) {
      return this.listFavoriteClipsUseCase.execute(req.user.userId, {
        cursor: query.cursor,
        type: query.type,
        q: query.q,
      });
    }

    return this.listRecentClipsUseCase.execute(req.user.userId, {
      cursor: query.cursor,
      type: query.type,
      q: query.q,
    });
  }

  @Get('views/recent')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '최근 조회한 클립 목록 조회' })
  @ApiOkResponse({
    description: '최근 조회한 클립 최대 50개를 반환합니다.',
    type: RecentViewedClipListResponseDto,
  })
  getRecentViewedClips(@Request() req: { user: AuthContext }) {
    return this.listRecentViewedClipsUseCase.execute(req.user.userId);
  }

  @Post()
  @UseGuards(JwtAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '클립 생성' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateClipDto })
  @ApiOkResponse({
    description: '생성된 클립 정보를 반환합니다.',
    type: ClipResponseDto,
  })
  @ApiNotFoundResponse({
    description: '폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  createClip(
    @Request() req: { user: AuthContext },
    @Body() dto: CreateClipDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.createClipUseCase.execute(
      req.user.userId,
      {
        ...dto,
      },
      file,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '클립 수정' })
  @ApiParam({ name: 'id', description: '클립 ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateClipDto })
  @ApiOkResponse({
    description: '수정된 클립 정보를 반환합니다.',
    type: ClipResponseDto,
  })
  @ApiNotFoundResponse({
    description: '클립 또는 폴더를 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  updateClip(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
    @Body() dto: UpdateClipDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.updateClipUseCase.execute(
      req.user.userId,
      {
        clipId: id,
        ...dto,
      },
      file,
    );
  }

  @Delete('all')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '클립 전체 삭제' })
  @ApiOkResponse({
    description: '소프트 삭제된 클립 개수를 반환합니다.',
    type: DeleteClipsResponseDto,
  })
  deleteAllClips(@Request() req: { user: AuthContext }) {
    return this.deleteAllClipsUseCase.execute(req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '클립 삭제' })
  @ApiParam({ name: 'id', description: '클립 ID' })
  @ApiOkResponse({
    description: '소프트 삭제된 클립 정보를 반환합니다.',
    type: ClipResponseDto,
  })
  @ApiNotFoundResponse({
    description: '클립을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  deleteClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.deleteClipUseCase.execute(req.user.userId, id);
  }

  @Delete()
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '클립 다중 삭제' })
  @ApiBody({ type: DeleteClipsDto })
  @ApiOkResponse({
    description: '소프트 삭제된 클립 개수를 반환합니다.',
    type: DeleteClipsResponseDto,
  })
  @ApiNotFoundResponse({
    description: '클립을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  deleteClips(
    @Request() req: { user: AuthContext },
    @Body() dto: DeleteClipsDto,
  ) {
    return this.deleteClipsUseCase.execute(req.user.userId, dto);
  }

  @Post(':id/views')
  @HttpCode(204)
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '클립 조회 이벤트 기록' })
  @ApiParam({ name: 'id', description: '클립 ID' })
  @ApiNoContentResponse({
    description: '조회 이벤트가 기록되었습니다.',
  })
  @ApiNotFoundResponse({
    description: '클립을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  recordClipView(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
  ) {
    return this.recordClipViewUseCase.execute(req.user.userId, id);
  }

  @Post(':id/likes')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '클립 좋아요 등록' })
  @ApiParam({ name: 'id', description: '클립 ID' })
  @ApiOkResponse({
    description: '좋아요 상태를 반환합니다.',
    type: LikeClipResponseDto,
  })
  @ApiNotFoundResponse({
    description: '클립을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  likeClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.likeClipUseCase.execute(req.user.userId, id);
  }

  @Delete(':id/likes')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '클립 좋아요 취소' })
  @ApiParam({ name: 'id', description: '클립 ID' })
  @ApiOkResponse({
    description: '좋아요 상태를 반환합니다.',
    type: LikeClipResponseDto,
  })
  @ApiNotFoundResponse({
    description: '클립을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  unlikeClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.unlikeClipUseCase.execute(req.user.userId, id);
  }
}
