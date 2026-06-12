import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { FoldersController } from './presentation/folders.controller';
import { FOLDERS_REPOSITORY } from './domain/folders.repository';
import { PrismaFoldersRepository } from './infrastructure/prisma-folders.repository';
import { GetFolderUseCase } from './application/usecases/get-folder.usecase';
import { ListFoldersUseCase } from './application/usecases/list-folders.usecase';
import { ReorderFolderUseCase } from './application/usecases/reorder-folder.usecase';
import { DeleteFolderUseCase } from './application/usecases/delete-folder.usecase';
import { CreateFolderUseCase } from './application/usecases/create-folder.usecase';
import { UpdateFolderUseCase } from './application/usecases/update-folder.usecase';
import { ListFolderTagsUseCase } from './application/usecases/list-folder-tags.usecase';
import { CreateFolderTagUseCase } from './application/usecases/create-folder-tag.usecase';
import { UpdateFolderTagUseCase } from './application/usecases/update-folder-tag.usecase';
import { DeleteFolderTagUseCase } from './application/usecases/delete-folder-tag.usecase';

@Module({
  controllers: [FoldersController],
  providers: [
    { provide: FOLDERS_REPOSITORY, useClass: PrismaFoldersRepository },
    ListFoldersUseCase,
    GetFolderUseCase,
    CreateFolderUseCase,
    UpdateFolderUseCase,
    ListFolderTagsUseCase,
    CreateFolderTagUseCase,
    UpdateFolderTagUseCase,
    DeleteFolderTagUseCase,
    ReorderFolderUseCase,
    DeleteFolderUseCase,
    JwtAccessGuard,
  ],
})
export class FoldersModule {}
