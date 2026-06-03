import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/common/presentation/guards/jwt-access.guard';
import { FoldersController } from './presentation/folders.controller';
import { FOLDERS_REPOSITORY } from './domain/folders.repository';
import { PrismaFoldersRepository } from './infrastructure/prisma-folders.repository';
import { GetFolderUseCase } from './application/usecases/get-folder.usecase';
import { ReorderFolderUseCase } from './application/usecases/reorder-folder.usecase';
import { DeleteFolderUseCase } from './application/usecases/delete-folder.usecase';
import { SaveFolderUseCase } from './application/usecases/save-folder.usecase';

@Module({
  controllers: [FoldersController],
  providers: [
    { provide: FOLDERS_REPOSITORY, useClass: PrismaFoldersRepository },
    GetFolderUseCase,
    SaveFolderUseCase,
    ReorderFolderUseCase,
    DeleteFolderUseCase,
    JwtAccessGuard,
  ],
})
export class FoldersModule {}
