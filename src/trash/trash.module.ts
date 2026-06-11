import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { TRASH_REPOSITORY } from './domain/trash.repository';
import { PrismaTrashRepository } from './infrastructure/prisma-trash.repository';
import { TrashController } from './presentation/trash.controller';
import { ListTrashClipsUseCase } from './application/usecases/list-trash-clips.usecase';
import { RestoreTrashClipUseCase } from './application/usecases/restore-trash-clip.usecase';
import { DeleteTrashClipUseCase } from './application/usecases/delete-trash-clip.usecase';
import { ListTrashFoldersUseCase } from './application/usecases/list-trash-folders.usecase';
import { RestoreTrashFolderUseCase } from './application/usecases/restore-trash-folder.usecase';
import { DeleteTrashFolderUseCase } from './application/usecases/delete-trash-folder.usecase';

@Module({
  controllers: [TrashController],
  providers: [
    { provide: TRASH_REPOSITORY, useClass: PrismaTrashRepository },
    ListTrashClipsUseCase,
    RestoreTrashClipUseCase,
    DeleteTrashClipUseCase,
    ListTrashFoldersUseCase,
    RestoreTrashFolderUseCase,
    DeleteTrashFolderUseCase,
    JwtAccessGuard,
  ],
})
export class TrashModule {}
