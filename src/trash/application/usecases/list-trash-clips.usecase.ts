import { Inject, Injectable } from '@nestjs/common';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';

@Injectable()
export class ListTrashClipsUseCase {
  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
  ) {}

  async execute(userId: string) {
    return {
      items: await this.trashRepository.findDeletedClips(userId),
    };
  }
}
