import { Module, Provider } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { ClipsController } from './presentation/clips.controller';
import { CLIPS_REPOSITORY, ClipsRepository } from './domain/clips.repository';
import { PrismaClipsRepository } from './infrastructure/prisma-clips.repository';
import { GetClipUseCase } from './application/usecases/get-clip.usecase';
import { DeleteClipUseCase } from './application/usecases/delete-clip.usecase';
import { SaveClipUseCase } from './application/usecases/save-clip.usecase';

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
    provide: DeleteClipUseCase,
    useFactory: (repo: ClipsRepository) => new DeleteClipUseCase(repo),
    inject: [CLIPS_REPOSITORY],
  },
];

@Module({
  controllers: [ClipsController],
  providers: [...clipUseCases, JwtAccessGuard],
})
export class ClipsModule {}
