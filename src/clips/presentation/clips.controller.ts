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
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { AuthContext } from 'src/auth/application/auth-context';
import { CreateClipDto } from './dtos/create-clip.dto';
import { UpdateClipDto } from './dtos/update-clip.dto';
import { GetClipUseCase } from '../application/usecases/get-clip.usecase';
import { DeleteClipUseCase } from '../application/usecases/delete-clip.usecase';
import { SaveClipUseCase } from '../application/usecases/save-clip.usecase';
import { ClipsError } from '../application/clips.error';

@Controller('clips')
export class ClipsController {
  constructor(
    private readonly saveClipUseCase: SaveClipUseCase,
    private readonly getClipUseCase: GetClipUseCase,
    private readonly deleteClipUseCase: DeleteClipUseCase,
  ) {}

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

  // 삭제되지 않은 내 클립을 단건으로 조회한다.
  @Get(':id')
  @UseGuards(JwtAccessGuard)
  getClip(@Request() req: { user: AuthContext }, @Param('id') id: string) {
    return this.run(() => this.getClipUseCase.execute(req.user.userId, id));
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
