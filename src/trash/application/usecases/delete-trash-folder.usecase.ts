import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CLIP_IMAGE_STORAGE_PORT,
  type ClipImageStoragePort,
} from 'src/shared/application/ports/clip-image-storage.port';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';
import { TrashError } from '../errors/trash.error';

@Injectable()
export class DeleteTrashFolderUseCase {
  private readonly logger = new Logger(DeleteTrashFolderUseCase.name);

  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
    @Inject(CLIP_IMAGE_STORAGE_PORT)
    private readonly clipImageStoragePort: ClipImageStoragePort,
  ) {}

  async execute(userId: string, folderId: string) {
    const folder = await this.trashRepository.findDeletedFolderById(
      userId,
      folderId,
    );

    if (!folder) {
      throw new TrashError('NOT_FOUND', '휴지통 폴더를 찾을 수 없습니다.');
    }

    const result = await this.trashRepository.hardDeleteFolderWithClips(
      folder.id,
    );
    await this.deleteImagesBestEffort(result.imageUrls);

    return {
      success: true as const,
    };
  }

  private async deleteImagesBestEffort(imageUrls: string[]): Promise<void> {
    await Promise.all(
      imageUrls.map(async (imageUrl) => {
        try {
          await this.clipImageStoragePort.deleteImage(imageUrl);
        } catch (error) {
          this.logger.warn(
            `휴지통 폴더 하위 이미지 삭제에 실패했습니다. imageUrl=${imageUrl}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }),
    );
  }
}
