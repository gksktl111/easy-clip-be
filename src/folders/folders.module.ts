import { Module, Provider } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { FoldersController } from './presentation/folders.controller';
import {
  FOLDERS_REPOSITORY,
  FoldersRepository,
} from './domain/folders.repository';
import { PrismaFoldersRepository } from './infrastructure/prisma-folders.repository';
import { GetFolderUseCase } from './application/usecases/get-folder.usecase';
import { ReorderFolderUseCase } from './application/usecases/reorder-folder.usecase';
import { DeleteFolderUseCase } from './application/usecases/delete-folder.usecase';
import { SaveFolderUseCase } from './application/usecases/save-folder.usecase';

const folderUseCases: Provider[] = [
  { provide: FOLDERS_REPOSITORY, useClass: PrismaFoldersRepository },
  {
    provide: GetFolderUseCase,
    useFactory: (repo: FoldersRepository) => new GetFolderUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
  {
    provide: SaveFolderUseCase,
    useFactory: (repo: FoldersRepository) => new SaveFolderUseCase(repo),
    inject: [FOLDERS_REPOSITORY],
  },
  {
    provide: ReorderFolderUseCase,
    useFactory: (repo: FoldersRepository) => new ReorderFolderUseCase(repo),
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
