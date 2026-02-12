import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { AuthContext } from 'src/auth/application/auth-context';
import { CreateClipDto } from './dtos/create-clip.dto';
import { ListClipsQueryDto } from './dtos/list-clips-query.dto';
import { UpdateClipDto } from './dtos/update-clip.dto';
import { GetClipUseCase } from '../application/usecases/get-clip.usecase';
import { DeleteClipUseCase } from '../application/usecases/delete-clip.usecase';
import { SaveClipUseCase } from '../application/usecases/save-clip.usecase';
import { ListClipsControllerFacade } from '../application/usecases/list-clips.controller-facade';
import { LikeClipUseCase } from '../application/usecases/like-clip.usecase';
import { UnlikeClipUseCase } from '../application/usecases/unlike-clip.usecase';
import { ClipsError } from '../application/clips.error';
import { RecordClipViewUseCase } from '../application/usecases/record-clip-view.usecase';
import { ListRecentViewedClipsUseCase } from '../application/usecases/list-recent-viewed-clips.usecase';

@Controller('clips')
export class ClipsController {
  constructor(
    private readonly saveClipUseCase: SaveClipUseCase,
    private readonly getClipUseCase: GetClipUseCase,
    private readonly deleteClipUseCase: DeleteClipUseCase,
    private readonly listClipsFacade: ListClipsControllerFacade,
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
    return this.run(() =>
      this.listClipsFacade.execute(req.user.userId, {
        ...query,
        favorite: query.favorite === 'true',
        recent: query.recent === 'true',
      }),
    );
  }

  // 최근 조회한 클립 50개를 최신순으로 조회한다.
  @Get('views/recent')
  @UseGuards(JwtAccessGuard)
  getRecentViewedClips(@Request() req: { user: AuthContext }) {
    return this.run(() =>
      this.listRecentViewedClipsUseCase.execute(req.user.userId),
    );
  }

  // 삭제되지 않은 내 클립을 단건으로 조회한다.
  @Get(':id')
  @UseGuards(JwtAccessGuard)
  getClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.run(() => this.getClipUseCase.execute(req.user.userId, id));
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
    return this.run(() =>
      this.saveClipUseCase.execute(
        req.user.userId,
        {
          mode: 'create',
          ...dto,
        },
        file,
      ),
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
    return this.run(() =>
      this.saveClipUseCase.execute(
        req.user.userId,
        {
          mode: 'update',
          clipId: id,
          ...dto,
        },
        file,
      ),
    );
  }

  // 클립을 즉시 제거하지 않고 deletedAt만 기록한다.
  @Delete(':id')
  @UseGuards(JwtAccessGuard)
  deleteClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.run(() => this.deleteClipUseCase.execute(req.user.userId, id));
  }

  // 클립 조회 이벤트를 기록한다.
  @Post(':id/views')
  @UseGuards(JwtAccessGuard)
  recordClipView(
    @Request() req: { user: AuthContext },
    @Param('id') id: string,
  ) {
    return this.run(() =>
      this.recordClipViewUseCase.execute(req.user.userId, id),
    );
  }

  // 클립에 좋아요를 등록한다.
  @Post(':id/likes')
  @UseGuards(JwtAccessGuard)
  likeClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.run(() => this.likeClipUseCase.execute(req.user.userId, id));
  }

  // 클립 좋아요를 취소한다.
  @Delete(':id/likes')
  @UseGuards(JwtAccessGuard)
  unlikeClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.run(() => this.unlikeClipUseCase.execute(req.user.userId, id));
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ClipsError) {
        throw this.toHttpException(error);
      }
      throw error;
    }
  }

  private toHttpException(error: ClipsError) {
    switch (error.code) {
      case 'BAD_REQUEST':
        return new BadRequestException(error.message);
      case 'NOT_FOUND':
        return new NotFoundException(error.message);
      default:
        return new InternalServerErrorException(error.message);
    }
  }
}
