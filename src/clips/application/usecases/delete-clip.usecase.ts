import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';

@Injectable()
export class DeleteClipUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(userId: string, clipId: string) {
    const clip = await this.clipsRepository.findClipByIdForUser(userId, clipId);

    if (!clip) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    return this.clipsRepository.softDeleteClip(clip.id);
  }
}
