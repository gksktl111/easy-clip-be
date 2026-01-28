import { Module, Provider } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { FoldersController } from './presentation/folders.controller';
import {
  FOLDERS_REPOSITORY,
  FoldersRepository,
} from './domain/folders.repository';
import { PrismaFoldersRepository } from './infrastructure/prisma-folders.repository';
import { GetFoldersUseCase } from './application/usecases/get-folders.usecase';
import { GetFolderUseCase } from './application/usecases/get-folder.usecase';
import { GetFolderClipsUseCase } from './application/usecases/get-folder-clips.usecase';
import { CreateFolderUseCase } from './application/usecases/create-folder.usecase';
import { ReorderFolderUseCase } from './application/usecases/reorder-folder.usecase';
import { UpdateFolderUseCase } from './application/usecases/update-folder.usecase';
import { DeleteFolderUseCase } from './application/usecases/delete-folder.usecase';

const folderUseCases: Provider[] = [
  { provide: FOLDERS_REPOSITORY, useClass: PrismaFoldersRepository },
  {
    provide: GetFoldersUseCase,
    useFactory: (repo: FoldersRepository) => new GetFoldersUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
  {
    provide: GetFolderUseCase,
    useFactory: (repo: FoldersRepository) => new GetFolderUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
  {
    provide: GetFolderClipsUseCase,
    useFactory: (repo: FoldersRepository) => new GetFolderClipsUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
  {
    provide: CreateFolderUseCase,
    useFactory: (repo: FoldersRepository) => new CreateFolderUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
  {
    provide: ReorderFolderUseCase,
    useFactory: (repo: FoldersRepository) => new ReorderFolderUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
  {
    provide: UpdateFolderUseCase,
    useFactory: (repo: FoldersRepository) => new UpdateFolderUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
  {
    provide: DeleteFolderUseCase,
    useFactory: (repo: FoldersRepository) => new DeleteFolderUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
];

@Module({
  controllers: [FoldersController],
  providers: [...folderUseCases, JwtAccessGuard],
})
export class FoldersModule {}
