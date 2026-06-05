import { Inject, Injectable } from '@nestjs/common';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';
import { TrashError } from '../errors/trash.error';

@Injectable()
export class DeleteTrashFolderUseCase {
  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
  ) {}

  async execute(userId: string, folderId: string) {
    const folder = await this.trashRepository.findDeletedFolderById(
      userId,
      folderId,
    );

    if (!folder) {
      throw new TrashError('NOT_FOUND', '휴지통 폴더를 찾을 수 없습니다.');
    }

    await this.trashRepository.hardDeleteFolderWithClips(folder.id);

    return {
      success: true as const,
    };
  }
}
