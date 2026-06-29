import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CLIP_IMAGE_STORAGE_PORT,
  type ClipImageStoragePort,
} from 'src/shared/application/ports/clip-image-storage.port';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';

@Injectable()
export class DeleteAllTrashItemsUseCase {
  private readonly logger = new Logger(DeleteAllTrashItemsUseCase.name);

  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
    @Inject(CLIP_IMAGE_STORAGE_PORT)
    private readonly clipImageStoragePort: ClipImageStoragePort,
  ) {}

  async execute(userId: string) {
    const result =
      await this.trashRepository.hardDeleteAllTrashItemsForUser(userId);
    await this.deleteImagesBestEffort(result.imageUrls);

    return {
      clipsDeleted: result.clipsDeleted,
      foldersDeleted: result.foldersDeleted,
      totalDeleted: result.totalDeleted,
    };
  }

  private async deleteImagesBestEffort(imageUrls: string[]): Promise<void> {
    await Promise.all(
      imageUrls.map(async (imageUrl) => {
        try {
          await this.clipImageStoragePort.deleteImage(imageUrl);
        } catch (error) {
          this.logger.warn(
            `휴지통 전체 삭제 중 이미지 삭제에 실패했습니다. imageUrl=${imageUrl}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }),
    );
  }
}
