import { Inject, Injectable } from '@nestjs/common';
import { ClipType } from '../../domain/clip.types';
import {
  CLIPS_REPOSITORY,
  ClipSearchTarget,
  ClipTypeFilter,
} from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../errors/clips.error';
import { normalizeCursor, normalizeType } from './list-clips.common';
import {
  listClipsWithLikedPriority,
  resolveClipSearchTarget,
} from './list-clips.policy';

export type ListFolderClipsInput = {
  folderId: string;
  cursor?: string;
  type: ClipTypeFilter;
  q?: string;
};

@Injectable()
export class ListFolderClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(userId: string, input: ListFolderClipsInput) {
    const cursor = normalizeCursor(input.cursor);
    const type = normalizeType(input.type);
    const query = input.q?.trim();

    const folder = await this.clipsRepository.findPersonalFolderById(
      userId,
      input.folderId,
    );

    if (!folder) {
      throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const searchTarget = await resolveClipSearchTarget(this.clipsRepository, {
      userId,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
      type,
      q: query,
      likedOnly: undefined,
    });

    const cursorLiked = await this.validateCursor({
      userId,
      cursor,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
      type,
      q: query,
      searchTarget,
    });

    return listClipsWithLikedPriority({
      clipsRepository: this.clipsRepository,
      userId,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
      cursor,
      cursorLiked,
      type,
      q: query,
      searchTarget,
    });
  }

  private async validateCursor({
    userId,
    cursor,
    folderId,
    workspaceId,
    type,
    q,
    searchTarget,
  }: {
    userId: string;
    cursor: string | undefined;
    folderId: string;
    workspaceId: string;
    type?: ClipType;
    q?: string;
    searchTarget?: ClipSearchTarget;
  }) {
    if (!cursor) {
      return null;
    }

    const cursorClip = await this.clipsRepository.findClipByIdForUser(
      userId,
      cursor,
    );

    if (!cursorClip || cursorClip.folderId !== folderId) {
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

    if (q && searchTarget) {
      const matches = await this.clipsRepository.isClipMatchingQuery({
        userId,
        folderId,
        workspaceId,
        type,
        q,
        searchTarget,
        likedOnly: undefined,
        clipId: cursor,
      });

      if (!matches) {
        throw new ClipsError(
          'NOT_FOUND',
          '커서에 해당하는 클립을 찾을 수 없습니다.',
        );
      }
    }

    return this.clipsRepository.isClipLikedByUser(userId, cursor);
  }
}
