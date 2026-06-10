import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { LikeClipOutput } from '../dtos/like-clip-output.dto';
import { ClipsError } from '../errors/clips.error';

@Injectable()
export class LikeClipUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(userId: string, clipId: string): Promise<LikeClipOutput> {
    const clip = await this.clipsRepository.findClipByIdForUser(userId, clipId);

    if (!clip) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    await this.clipsRepository.createClipLike(userId, clipId);

    return { likeByMe: true };
  }
}
