import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { CLIP_IMAGE_STORAGE_PORT } from 'src/shared/application/ports/clip-image-storage.port';
import { R2ClipImageStorageService } from 'src/shared/infrastructure/r2-clip-image-storage.service';
import { TRASH_REPOSITORY } from './domain/trash.repository';
import { PrismaTrashRepository } from './infrastructure/prisma-trash.repository';
import { TrashController } from './presentation/trash.controller';
import { ListTrashItemsUseCase } from './application/usecases/list-trash-items.usecase';
import { RestoreTrashClipUseCase } from './application/usecases/restore-trash-clip.usecase';
import { DeleteTrashClipUseCase } from './application/usecases/delete-trash-clip.usecase';
import { RestoreTrashFolderUseCase } from './application/usecases/restore-trash-folder.usecase';
import { DeleteTrashFolderUseCase } from './application/usecases/delete-trash-folder.usecase';
import { DeleteAllTrashItemsUseCase } from './application/usecases/delete-all-trash-items.usecase';
import { PurgeExpiredTrashItemsUseCase } from './application/usecases/purge-expired-trash-items.usecase';
import { TrashCleanupScheduler } from './infrastructure/trash-cleanup.scheduler';

@Module({
  controllers: [TrashController],
  providers: [
    { provide: TRASH_REPOSITORY, useClass: PrismaTrashRepository },
    { provide: CLIP_IMAGE_STORAGE_PORT, useClass: R2ClipImageStorageService },
    ListTrashItemsUseCase,
    RestoreTrashClipUseCase,
    DeleteTrashClipUseCase,
    RestoreTrashFolderUseCase,
    DeleteTrashFolderUseCase,
    DeleteAllTrashItemsUseCase,
    PurgeExpiredTrashItemsUseCase,
    TrashCleanupScheduler,
    JwtAccessGuard,
  ],
})
export class TrashModule {}
