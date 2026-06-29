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
export class DeleteTrashClipUseCase {
  private readonly logger = new Logger(DeleteTrashClipUseCase.name);

  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
    @Inject(CLIP_IMAGE_STORAGE_PORT)
    private readonly clipImageStoragePort: ClipImageStoragePort,
  ) {}

  async execute(userId: string, clipId: string) {
    const clip = await this.trashRepository.findDeletedClipById(userId, clipId);

    if (!clip) {
      throw new TrashError('NOT_FOUND', '휴지통 클립을 찾을 수 없습니다.');
    }

    const result = await this.trashRepository.hardDeleteClip(clip.id);
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
            `휴지통 클립 이미지 삭제에 실패했습니다. imageUrl=${imageUrl}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }),
    );
  }
}
