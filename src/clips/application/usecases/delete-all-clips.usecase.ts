import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import type { DeleteClipsOutput } from '../dtos/delete-clips-output.dto';
import { ClipsError } from '../errors/clips.error';

@Injectable()
export class DeleteAllClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(userId: string, folderId: string): Promise<DeleteClipsOutput> {
    const folder = await this.clipsRepository.findPersonalFolderById(
      userId,
      folderId,
    );

    if (!folder) {
      throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const deletedCount = await this.clipsRepository.softDeleteAllClipsInFolder(
      userId,
      folder.id,
    );

    return { deletedCount };
  }
}
