import { ClipTypeFilter } from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';
import { ListFavoriteClipsUseCase } from './list-favorite-clips.usecase';
import { ListFolderClipsUseCase } from './list-folder-clips.usecase';
import { ListRecentClipsUseCase } from './list-recent-clips.usecase';

export type ListClipsFacadeInput = {
  folderId?: string;
  cursor?: string;
  type?: ClipTypeFilter;
  q?: string;
  favorite?: boolean;
  recent?: boolean;
};

export class ListClipsControllerFacade {
  constructor(
    private readonly listFolderClips: ListFolderClipsUseCase,
    private readonly listFavoriteClips: ListFavoriteClipsUseCase,
    private readonly listRecentClips: ListRecentClipsUseCase,
  ) {}

  async execute(userId: string, input: ListClipsFacadeInput) {
    if (!input.type) {
      throw new ClipsError('BAD_REQUEST', '잘못된 요청입니다.');
    }

    if (input.folderId) {
      if (input.favorite || input.recent) {
        throw new ClipsError('BAD_REQUEST', '잘못된 요청입니다.');
      }

      return this.listFolderClips.execute(userId, {
        folderId: input.folderId,
        cursor: input.cursor,
        type: input.type,
        q: input.q,
      });
    }

    if (Boolean(input.favorite) === Boolean(input.recent)) {
      throw new ClipsError('BAD_REQUEST', '잘못된 요청입니다.');
    }

    if (input.favorite) {
      return this.listFavoriteClips.execute(userId, {
        cursor: input.cursor,
        type: input.type,
        q: input.q,
      });
    }

    return this.listRecentClips.execute(userId, {
      cursor: input.cursor,
      type: input.type,
      q: input.q,
    });
  }
}
