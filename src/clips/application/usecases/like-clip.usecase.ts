import { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';

export class LikeClipUseCase {
  constructor(private readonly clipsRepository: ClipsRepository) {}

  async execute(userId: string, clipId: string) {
    const clip = await this.clipsRepository.findClipByIdForUser(userId, clipId);

    if (!clip) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    await this.clipsRepository.createClipLike(userId, clipId);

    return { likeByMe: true };
  }
}
