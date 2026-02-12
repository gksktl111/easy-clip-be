import { Module, Provider } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { ClipsController } from './presentation/clips.controller';
import { CLIPS_REPOSITORY, ClipsRepository } from './domain/clips.repository';
import { PrismaClipsRepository } from './infrastructure/prisma-clips.repository';
import { GetClipUseCase } from './application/usecases/get-clip.usecase';
import { DeleteClipUseCase } from './application/usecases/delete-clip.usecase';
import { SaveClipUseCase } from './application/usecases/save-clip.usecase';
import { ListFavoriteClipsUseCase } from './application/usecases/list-favorite-clips.usecase';
import { ListFolderClipsUseCase } from './application/usecases/list-folder-clips.usecase';
import { ListRecentClipsUseCase } from './application/usecases/list-recent-clips.usecase';
import { ListClipsControllerFacade } from './application/usecases/list-clips.controller-facade';
import { LikeClipUseCase } from './application/usecases/like-clip.usecase';
import { UnlikeClipUseCase } from './application/usecases/unlike-clip.usecase';
import { RecordClipViewUseCase } from './application/usecases/record-clip-view.usecase';
import { ListRecentViewedClipsUseCase } from './application/usecases/list-recent-viewed-clips.usecase';

const clipUseCases: Provider[] = [
  { provide: CLIPS_REPOSITORY, useClass: PrismaClipsRepository },
  {
    provide: SaveClipUseCase,
    useFactory: (repo: ClipsRepository) => new SaveClipUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: GetClipUseCase,
    useFactory: (repo: ClipsRepository) => new GetClipUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: ListFolderClipsUseCase,
    useFactory: (repo: ClipsRepository) => new ListFolderClipsUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: ListFavoriteClipsUseCase,
    useFactory: (repo: ClipsRepository) => new ListFavoriteClipsUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: ListRecentClipsUseCase,
    useFactory: (repo: ClipsRepository) => new ListRecentClipsUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: ListClipsControllerFacade,
    useFactory: (
      listFolder: ListFolderClipsUseCase,
      listFavorite: ListFavoriteClipsUseCase,
      listRecent: ListRecentClipsUseCase,
    ) => new ListClipsControllerFacade(listFolder, listFavorite, listRecent),
    inject: [
      ListFolderClipsUseCase,
      ListFavoriteClipsUseCase,
      ListRecentClipsUseCase,
    ],
  },
  {
    provide: DeleteClipUseCase,
    useFactory: (repo: ClipsRepository) => new DeleteClipUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: LikeClipUseCase,
    useFactory: (repo: ClipsRepository) => new LikeClipUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: UnlikeClipUseCase,
    useFactory: (repo: ClipsRepository) => new UnlikeClipUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: RecordClipViewUseCase,
    useFactory: (repo: ClipsRepository) => new RecordClipViewUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
  {
    provide: ListRecentViewedClipsUseCase,
    useFactory: (repo: ClipsRepository) =>
      new ListRecentViewedClipsUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
];

@Module({
  controllers: [ClipsController],
  providers: [...clipUseCases, JwtAccessGuard],
})
export class ClipsModule {}
