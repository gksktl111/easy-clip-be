import { Inject, Injectable } from '@nestjs/common';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';
import { RestoreTrashItem } from '../../domain/trash.types';
import {
  RestoreTrashItemsInput,
  RestoreTrashItemsOutput,
} from '../dtos/restore-trash-items-input.dto';
import { TrashError } from '../errors/trash.error';

@Injectable()
export class RestoreTrashItemsUseCase {
  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
  ) {}

  async execute(
    userId: string,
    input: RestoreTrashItemsInput,
  ): Promise<RestoreTrashItemsOutput> {
    const items = this.deduplicateItems(input.items);

    if (items.length === 0) {
      throw new TrashError('BAD_REQUEST', '복구할 휴지통 항목이 없습니다.');
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

    const restoreFolderIds = new Set(folderIds);
    const blockedClip = clips.find(
      (clip) => clip.folderDeletedAt && !restoreFolderIds.has(clip.folderId),
    );

    if (blockedClip) {
      throw new TrashError(
        'CONFLICT',
        '삭제된 폴더에 속한 클립은 단독으로 복구할 수 없습니다.',
      );
    }

    const restoreClipIds = clips
      .filter((clip) => !restoreFolderIds.has(clip.folderId))
      .map((clip) => clip.id);

    await this.trashRepository.restoreItems({
      userId,
      clipIds: restoreClipIds,
      folderIds,
    });

    return { restoredCount: items.length };
  }

  private deduplicateItems(items: RestoreTrashItem[]): RestoreTrashItem[] {
    const itemMap = new Map<string, RestoreTrashItem>();

    for (const item of items) {
      itemMap.set(`${item.itemType}:${item.id}`, item);
    }

    return [...itemMap.values()];
  }
}
