import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import type { DeleteClipsOutput } from '../dtos/delete-clips-output.dto';

@Injectable()
export class DeleteAllClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(userId: string): Promise<DeleteClipsOutput> {
    const deletedCount =
      await this.clipsRepository.softDeleteAllClipsForUser(userId);

    return { deletedCount };
  }
}
