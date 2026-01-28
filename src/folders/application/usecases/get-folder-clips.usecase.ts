import { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../folders.error';

export type GetFolderClipsQuery = {
  cursor?: string;
  limit?: number;
};

export class GetFolderClipsUseCase {
  constructor(private readonly foldersRepository: FoldersRepository) {}

  async execute(
    userId: string,
    folderId: string,
    query: GetFolderClipsQuery,
  ) {
    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      folderId,
    );

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const limit = query.limit ?? 20;

    if (query.cursor) {
      const cursorClip = await this.foldersRepository.findClipByIdInFolder(
        folder.id,
        folder.workspaceId,
        query.cursor,
      );

      if (!cursorClip) {
        throw new FoldersError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }
    }

    const clips = await this.foldersRepository.findClipsByFolder({
      folderId: folder.id,
      workspaceId: folder.workspaceId,
      cursor: query.cursor,
      limit,
    });

    const hasMore = clips.length > limit;
    const items = hasMore ? clips.slice(0, limit) : clips;
    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
    };
  }
}
