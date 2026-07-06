import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { CLIP_IMAGE_STORAGE_PORT } from 'src/shared/application/ports/clip-image-storage.port';
import { R2ClipImageStorageService } from 'src/shared/infrastructure/r2-clip-image-storage.service';
import { TRASH_REPOSITORY } from './domain/trash.repository';
import { PrismaTrashRepository } from './infrastructure/prisma-trash.repository';
import { TrashController } from './presentation/trash.controller';
import { ListTrashItemsUseCase } from './application/usecases/list-trash-items.usecase';
import { RestoreTrashItemsUseCase } from './application/usecases/restore-trash-items.usecase';
import { DeleteTrashItemsUseCase } from './application/usecases/delete-trash-items.usecase';
import { DeleteAllTrashItemsUseCase } from './application/usecases/delete-all-trash-items.usecase';
import { PurgeExpiredTrashItemsUseCase } from './application/usecases/purge-expired-trash-items.usecase';
import { TrashCleanupScheduler } from './infrastructure/trash-cleanup.scheduler';

@Module({
  controllers: [TrashController],
  providers: [
    { provide: TRASH_REPOSITORY, useClass: PrismaTrashRepository },
    { provide: CLIP_IMAGE_STORAGE_PORT, useClass: R2ClipImageStorageService },
    ListTrashItemsUseCase,
    RestoreTrashItemsUseCase,
    DeleteTrashItemsUseCase,
    DeleteAllTrashItemsUseCase,
    PurgeExpiredTrashItemsUseCase,
    TrashCleanupScheduler,
    JwtAccessGuard,
  ],
})
export class TrashModule {}
