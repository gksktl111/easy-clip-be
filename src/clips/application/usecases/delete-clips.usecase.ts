import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import type { DeleteClipsInput } from '../dtos/delete-clips-input.dto';
import type { DeleteClipsOutput } from '../dtos/delete-clips-output.dto';
import { ClipsError } from '../errors/clips.error';

@Injectable()
export class DeleteClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(
    userId: string,
    input: DeleteClipsInput,
  ): Promise<DeleteClipsOutput> {
    const clipIds = input.clipIds;

    if (clipIds.length === 0) {
      throw new ClipsError('BAD_REQUEST', '삭제할 클립을 선택해주세요.');
    }

    if (clipIds.some((clipId) => clipId.trim().length === 0)) {
      throw new ClipsError(
        'BAD_REQUEST',
        '잘못된 클립 ID가 포함되어 있습니다.',
      );
    }

    const uniqueClipIds = new Set(clipIds);

    if (uniqueClipIds.size !== clipIds.length) {
      throw new ClipsError(
        'BAD_REQUEST',
        '중복된 클립 ID가 포함되어 있습니다.',
      );
    }

    const clips = await this.clipsRepository.findClipsByIdsForUser(
      userId,
      clipIds,
    );

    if (clips.length !== clipIds.length) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    const deletedCount = await this.clipsRepository.softDeleteClips(clipIds);

    return { deletedCount };
  }
}
