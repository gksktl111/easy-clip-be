import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { ClipsController } from './presentation/clips.controller';
import { CLIPS_REPOSITORY } from './domain/clips.repository';
import { PrismaClipsRepository } from './infrastructure/prisma-clips.repository';
import { DeleteClipUseCase } from './application/usecases/delete-clip.usecase';
import { CreateClipUseCase } from './application/usecases/create-clip.usecase';
import { UpdateClipUseCase } from './application/usecases/update-clip.usecase';
import { ListFavoriteClipsUseCase } from './application/usecases/list-favorite-clips.usecase';
import { ListFolderClipsUseCase } from './application/usecases/list-folder-clips.usecase';
import { ListRecentClipsUseCase } from './application/usecases/list-recent-clips.usecase';
import { LikeClipUseCase } from './application/usecases/like-clip.usecase';
import { UnlikeClipUseCase } from './application/usecases/unlike-clip.usecase';
import { RecordClipViewUseCase } from './application/usecases/record-clip-view.usecase';
import { ListRecentViewedClipsUseCase } from './application/usecases/list-recent-viewed-clips.usecase';

@Module({
  controllers: [ClipsController],
  providers: [
    { provide: CLIPS_REPOSITORY, useClass: PrismaClipsRepository },
    CreateClipUseCase,
    UpdateClipUseCase,
    ListFolderClipsUseCase,
    ListFavoriteClipsUseCase,
    ListRecentClipsUseCase,
    DeleteClipUseCase,
    LikeClipUseCase,
    UnlikeClipUseCase,
    RecordClipViewUseCase,
    ListRecentViewedClipsUseCase,
    JwtAccessGuard,
  ],
})
export class ClipsModule {}
