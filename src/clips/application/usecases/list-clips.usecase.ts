import {
  ClipSearchTarget,
  ClipTypeFilter,
  ClipsRepository,
} from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';

export type ListClipsInput = {
  folderId?: string;
  cursor?: string;
  limit?: number;
  type?: ClipTypeFilter;
  q?: string;
};

export class ListClipsUseCase {
  constructor(private readonly clipsRepository: ClipsRepository) {}

  async execute(userId: string, input: ListClipsInput) {
    const limit = input.limit ?? 20;
    const type = input.type && input.type !== 'ALL' ? input.type : undefined;
    const query = input.q?.trim();

    const folder = input.folderId
      ? await this.clipsRepository.findPersonalFolderById(
          userId,
          input.folderId,
        )
      : null;

    if (input.folderId && !folder) {
      throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const folderId = folder?.id ?? input.folderId;
    const workspaceId = folder?.workspaceId;
    const searchTarget = await this.resolveSearchTarget({
      userId,
      folderId,
      workspaceId,
      type,
      q: query,
    });

    let cursorLiked: boolean | null = null;

    if (input.cursor) {
      const cursorClip = await this.clipsRepository.findClipByIdForUser(
        userId,
        input.cursor,
      );

      if (!cursorClip) {
        throw new ClipsError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }

      if (folder && cursorClip.folderId !== folder.id) {
        throw new ClipsError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }

      if (type && cursorClip.type !== type) {
        throw new ClipsError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }

      if (query && searchTarget) {
        const matches = await this.clipsRepository.isClipMatchingQuery({
          userId,
          folderId,
          workspaceId,
          type,
          q: query,
          searchTarget,
          likedOnly: undefined,
          clipId: input.cursor,
        });

        if (!matches) {
          throw new ClipsError(
            'NOT_FOUND',
            '커서에 해당하는 클립을 찾을 수 없습니다.',
          );
        }
      }

      cursorLiked = await this.clipsRepository.isClipLikedByUser(
        userId,
        input.cursor,
      );
    }

    const baseParams = {
      userId,
      folderId,
      workspaceId,
      limit,
      type,
      q: query,
      searchTarget,
    };

    if (cursorLiked === false) {
      return this.buildPage(
        await this.clipsRepository.findClips({
          ...baseParams,
          cursor: input.cursor,
          likedOnly: false,
        }),
        limit,
      );
    }

    const likedClips = await this.clipsRepository.findClips({
      ...baseParams,
      cursor: cursorLiked ? input.cursor : undefined,
      likedOnly: true,
    });
    const likedResult = this.buildPage(likedClips, limit);

    if (likedResult.hasMore) {
      return {
        items: likedResult.items,
        nextCursor: likedResult.nextCursor,
      };
    }

    const remaining = limit - likedResult.items.length;

    if (remaining > 0) {
      const nonLikedClips = await this.clipsRepository.findClips({
        ...baseParams,
        likedOnly: false,
        limit: remaining,
      });
      const combined = likedResult.items.concat(nonLikedClips);
      const combinedResult = this.buildPage(combined, limit);

      return {
        items: combinedResult.items,
        nextCursor: combinedResult.nextCursor,
      };
    }

    const hasNonLiked =
      (
        await this.clipsRepository.findClips({
          ...baseParams,
          likedOnly: false,
          limit: 1,
        })
      ).length > 0;

    return {
      items: likedResult.items,
      nextCursor:
        hasNonLiked && likedResult.items.length > 0
          ? likedResult.items[likedResult.items.length - 1].id
          : null,
    };
  }

  private async resolveSearchTarget({
    userId,
    folderId,
    workspaceId,
    type,
    q,
  }: {
    userId: string;
    folderId?: string;
    workspaceId?: string;
    type?: ClipTypeFilter;
    q?: string;
  }): Promise<ClipSearchTarget | undefined> {
    if (!q) {
      return undefined;
    }

    const hasTitleMatches = await this.clipsRepository.hasTitleMatches({
      userId,
      folderId,
      workspaceId,
      type,
      q,
      searchTarget: 'title',
      likedOnly: undefined,
    });

    return hasTitleMatches ? 'title' : 'tag';
  }

  private buildPage<T extends { id: string }>(items: T[], limit: number) {
    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;

    return {
      items: sliced,
      hasMore,
      nextCursor:
        hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null,
    };
  }
}
