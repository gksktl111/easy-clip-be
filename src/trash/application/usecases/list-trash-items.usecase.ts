import { Inject, Injectable } from '@nestjs/common';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';
import { TrashCursorPage, TrashItem } from '../../domain/trash.types';
import {
  ListTrashItemsInput,
  normalizeLimit,
  toCursorPage,
} from '../helpers/trash-pagination.helper';

@Injectable()
export class ListTrashItemsUseCase {
  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
  ) {}

  async execute(
    userId: string,
    input: ListTrashItemsInput = {},
  ): Promise<TrashCursorPage<TrashItem>> {
    const limit = normalizeLimit(input.limit);
    const items = await this.trashRepository.findDeletedItems({
      userId,
      cursor: input.cursor,
      limit: limit + 1,
    });

    return toCursorPage(items, limit, (item) => `${item.itemType}:${item.id}`);
  }
}
