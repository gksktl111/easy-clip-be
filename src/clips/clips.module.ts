import { BadRequestException, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { resolveMaxImageBytes } from 'src/shared/application/helpers/clip-image-validation.helper';
import { isAllowedClipImageMimeType } from 'src/shared/application/helpers/clip-image-mime-type.helper';
import { ClipUploadRateGuard } from './presentation/guards/clip-upload-rate.guard';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { ClipsController } from './presentation/clips.controller';
import { CLIPS_REPOSITORY } from './domain/clips.repository';
import { PrismaClipsRepository } from './infrastructure/prisma-clips.repository';
import { DeleteClipUseCase } from './application/usecases/delete-clip.usecase';
import { DeleteAllClipsUseCase } from './application/usecases/delete-all-clips.usecase';
import { DeleteClipsUseCase } from './application/usecases/delete-clips.usecase';
import { CreateClipUseCase } from './application/usecases/create-clip.usecase';
import { UpdateClipUseCase } from './application/usecases/update-clip.usecase';
import { ListFavoriteClipsUseCase } from './application/usecases/list-favorite-clips.usecase';
import { ListFolderClipsUseCase } from './application/usecases/list-folder-clips.usecase';
import { ListRecentClipsUseCase } from './application/usecases/list-recent-clips.usecase';
import { LikeClipUseCase } from './application/usecases/like-clip.usecase';
import { UnlikeClipUseCase } from './application/usecases/unlike-clip.usecase';
import { RecordClipViewUseCase } from './application/usecases/record-clip-view.usecase';
import { ListRecentViewedClipsUseCase } from './application/usecases/list-recent-viewed-clips.usecase';
import { ReplaceClipTagsUseCase } from './application/usecases/replace-clip-tags.usecase';
import { CLIP_IMAGE_STORAGE_PORT } from 'src/shared/application/ports/clip-image-storage.port';
import { R2ClipImageStorageService } from 'src/shared/infrastructure/r2-clip-image-storage.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: resolveMaxImageBytes(config.get('R2_MAX_IMAGE_BYTES')),
          files: 1,
          fields: 2,
          // Busboy emits partsLimit when this count is reached: allow 3 parts.
          parts: 4,
          fieldSize: 1024 * 1024,
          fieldNameSize: 100,
        },
        fileFilter: (_request, file, callback) => {
          if (!isAllowedClipImageMimeType(file.mimetype)) {
            return callback(
              new BadRequestException(
                'jpeg, png, webp, gif, avif 이미지만 업로드할 수 있습니다.',
              ),
              false,
            );
          }
          callback(null, true);
        },
      }),
    }),
  ],
  controllers: [ClipsController],
  providers: [
    { provide: CLIPS_REPOSITORY, useClass: PrismaClipsRepository },
    { provide: CLIP_IMAGE_STORAGE_PORT, useClass: R2ClipImageStorageService },
    CreateClipUseCase,
    UpdateClipUseCase,
    ListFolderClipsUseCase,
    ListFavoriteClipsUseCase,
    ListRecentClipsUseCase,
    DeleteClipUseCase,
    DeleteAllClipsUseCase,
    DeleteClipsUseCase,
    LikeClipUseCase,
    UnlikeClipUseCase,
    RecordClipViewUseCase,
    ListRecentViewedClipsUseCase,
    ReplaceClipTagsUseCase,
    JwtAccessGuard,
    ClipUploadRateGuard,
  ],
})
export class ClipsModule {}
