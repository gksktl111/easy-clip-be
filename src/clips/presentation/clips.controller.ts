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
import { JwtAccessGuard } from 'src/common/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/common/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/common/presentation/filters/application-exception.filter';
import { CreateClipDto } from './dtos/create-clip.dto';
import { ListClipsQueryDto } from './dtos/list-clips-query.dto';
import { UpdateClipDto } from './dtos/update-clip.dto';
import { DeleteClipUseCase } from '../application/usecases/delete-clip.usecase';
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

// TODO: 현재 clips 도메인이 콘텐츠 + 상호작용(Like, View, Favorite)을 모두 포함하며
// Aggregate 경계가 흐려지고 있음.
// → Clip(콘텐츠)과 Interaction(사용자-클립 관계)을 분리 필요.
//
// [분리 대상 엔드포인트]
// 1. View 관련
//    - POST   /clips/:id/views
//    - GET    /clips/views/recent
//
// 2. Like 관련
//    - POST   /clips/:id/likes
//    - DELETE /clips/:id/likes
//
// → 위 엔드포인트는 ClipController에서 제거 후
//   Interaction 전용 Controller로 이동.
//
// 목표:
// - Clip 도메인은 콘텐츠 CRUD 및 검색만 책임
// - Interaction 도메인은 사용자-클립 관계 데이터(Like/View/Favorite)만 책임
// - Clip은 Interaction을 모르도록 의존성 단방향 유지

@Controller('clips')
@UseFilters(ApplicationExceptionFilter)
export class ClipsController {
  constructor(
    private readonly createClipUseCase: CreateClipUseCase,
    private readonly updateClipUseCase: UpdateClipUseCase,
    private readonly deleteClipUseCase: DeleteClipUseCase,
    private readonly listFolderClipsUseCase: ListFolderClipsUseCase,
    private readonly listFavoriteClipsUseCase: ListFavoriteClipsUseCase,
    private readonly listRecentClipsUseCase: ListRecentClipsUseCase,
    private readonly likeClipUseCase: LikeClipUseCase,
    private readonly unlikeClipUseCase: UnlikeClipUseCase,
    private readonly recordClipViewUseCase: RecordClipViewUseCase,
    private readonly listRecentViewedClipsUseCase: ListRecentViewedClipsUseCase,
  ) {}

  // 클립 목록을 커서 기반으로 조회한다.
  @Get()
  @UseGuards(JwtAccessGuard)
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

  // 최근 조회한 클립 50개를 최신순으로 조회한다.
  @Get('views/recent')
  @UseGuards(JwtAccessGuard)
  getRecentViewedClips(@Request() req: { user: AuthContext }) {
    return this.listRecentViewedClipsUseCase.execute(req.user.userId);
  }

  // multipart 입력에서 file 우선 규칙으로 타입을 판별해 클립을 생성한다.
  @Post()
  @UseGuards(JwtAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  createClip(
    @Request() req: { user: AuthContext },
    @Body() dto: CreateClipDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.createClipUseCase.execute(
      req.user.userId,
      {
        ...dto,
      },
      file,
    );
  }

  // multipart 입력에서 file/text가 주어지면 타입을 재판별해 클립을 갱신한다.
  @Patch(':id')
  @UseGuards(JwtAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  updateClip(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
    @Body() dto: UpdateClipDto,
    @UploadedFile() file?: Express.Multer.File,
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

  // 클립을 즉시 제거하지 않고 deletedAt만 기록한다.
  @Delete(':id')
  @UseGuards(JwtAccessGuard)
  deleteClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.deleteClipUseCase.execute(req.user.userId, id);
  }

  // 클립 조회 이벤트를 기록한다.
  @Post(':id/views')
  @HttpCode(204)
  @UseGuards(JwtAccessGuard)
  recordClipView(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
  ) {
    return this.recordClipViewUseCase.execute(req.user.userId, id);
  }

  // 클립에 좋아요를 등록한다.
  @Post(':id/likes')
  @UseGuards(JwtAccessGuard)
  likeClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.likeClipUseCase.execute(req.user.userId, id);
  }

  // 클립 좋아요를 취소한다.
  @Delete(':id/likes')
  @UseGuards(JwtAccessGuard)
  unlikeClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.unlikeClipUseCase.execute(req.user.userId, id);
  }
}
