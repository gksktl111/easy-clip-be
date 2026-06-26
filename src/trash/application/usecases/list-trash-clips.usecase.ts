import { Inject, Injectable } from '@nestjs/common';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';
import { TrashClipItem, TrashCursorPage } from '../../domain/trash.types';
import {
  ListTrashItemsInput,
  normalizeLimit,
  toCursorPage,
} from '../helpers/trash-pagination.helper';

@Injectable()
export class ListTrashClipsUseCase {
  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
  ) {}

  async execute(
    userId: string,
    input: ListTrashItemsInput = {},
  ): Promise<TrashCursorPage<TrashClipItem>> {
    const limit = normalizeLimit(input.limit);
    const items = await this.trashRepository.findDeletedClips({
      userId,
      cursor: input.cursor,
      limit: limit + 1,
    });

    return toCursorPage(items, limit);
  }
}
