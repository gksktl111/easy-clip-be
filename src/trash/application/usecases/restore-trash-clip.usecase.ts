import { Inject, Injectable } from '@nestjs/common';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';
import { TrashError } from '../errors/trash.error';

@Injectable()
export class RestoreTrashClipUseCase {
  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
  ) {}

  async execute(userId: string, clipId: string) {
    const clip = await this.trashRepository.findDeletedClipById(userId, clipId);

    if (!clip) {
      throw new TrashError('NOT_FOUND', '휴지통 클립을 찾을 수 없습니다.');
    }

    if (clip.folderDeletedAt) {
      throw new TrashError(
        'CONFLICT',
        '삭제된 폴더에 속한 클립은 단독으로 복구할 수 없습니다.',
      );
    }

    return this.trashRepository.restoreClip(clip.id);
  }
}
