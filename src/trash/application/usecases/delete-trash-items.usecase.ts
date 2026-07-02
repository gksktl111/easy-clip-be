import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CLIP_IMAGE_STORAGE_PORT,
  type ClipImageStoragePort,
} from 'src/shared/application/ports/clip-image-storage.port';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';
import { RestoreTrashItem } from '../../domain/trash.types';
import {
  DeleteTrashItemsInput,
  DeleteTrashItemsOutput,
} from '../dtos/delete-trash-items-input.dto';
import { TrashError } from '../errors/trash.error';

@Injectable()
export class DeleteTrashItemsUseCase {
  private readonly logger = new Logger(DeleteTrashItemsUseCase.name);

  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
    @Inject(CLIP_IMAGE_STORAGE_PORT)
    private readonly clipImageStoragePort: ClipImageStoragePort,
  ) {}

  async execute(
    userId: string,
    input: DeleteTrashItemsInput,
  ): Promise<DeleteTrashItemsOutput> {
    const items = this.deduplicateItems(input.items);

    if (items.length === 0) {
      throw new TrashError('BAD_REQUEST', '삭제할 휴지통 항목이 없습니다.');
    }

    const clipIds = items
      .filter((item) => item.itemType === 'CLIP')
      .map((item) => item.id);
    const folderIds = items
      .filter((item) => item.itemType === 'FOLDER')
      .map((item) => item.id);

    const [clips, folders] = await Promise.all([
      this.trashRepository.findDeletedClipsByIds(userId, clipIds),
      this.trashRepository.findDeletedFoldersByIds(userId, folderIds),
    ]);

    if (clips.length !== clipIds.length) {
      throw new TrashError('NOT_FOUND', '휴지통 클립을 찾을 수 없습니다.');
    }

    if (folders.length !== folderIds.length) {
      throw new TrashError('NOT_FOUND', '휴지통 폴더를 찾을 수 없습니다.');
    }

    const deleteFolderIds = new Set(folderIds);
    const blockedClip = clips.find(
      (clip) => clip.folderDeletedAt && !deleteFolderIds.has(clip.folderId),
    );

    if (blockedClip) {
      throw new TrashError(
        'CONFLICT',
        '삭제된 폴더에 속한 클립은 단독으로 영구 삭제할 수 없습니다.',
      );
    }

    const deleteClipIds = clips
      .filter((clip) => !deleteFolderIds.has(clip.folderId))
      .map((clip) => clip.id);

    const result = await this.trashRepository.hardDeleteItems({
      userId,
      clipIds: deleteClipIds,
      folderIds,
    });
    await this.deleteImagesBestEffort(result.imageUrls);

    return {
      clipsDeleted: result.clipsDeleted,
      foldersDeleted: result.foldersDeleted,
      totalDeleted: result.totalDeleted,
    };
  }

  private deduplicateItems(items: RestoreTrashItem[]): RestoreTrashItem[] {
    const itemMap = new Map<string, RestoreTrashItem>();

    for (const item of items) {
      itemMap.set(`${item.itemType}:${item.id}`, item);
    }

    return [...itemMap.values()];
  }

  private async deleteImagesBestEffort(imageUrls: string[]): Promise<void> {
    await Promise.all(
      imageUrls.map(async (imageUrl) => {
        try {
          await this.clipImageStoragePort.deleteImage(imageUrl);
        } catch (error) {
          this.logger.warn(
            `휴지통 선택 삭제 중 이미지 삭제에 실패했습니다. imageUrl=${imageUrl}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }),
    );
  }
}
