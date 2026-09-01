import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { ClipCursorPageOutput } from '../dtos/clip-cursor-page-output.dto';
import { ListFolderClipsInput } from '../dtos/list-folder-clips-input.dto';
import { ClipsError } from '../errors/clips.error';
import {
  LIST_CLIPS_LIMIT,
  buildPage,
  normalizeCursor,
  normalizeType,
} from './list-clips.common';
import {
  resolveClipSearchTarget,
  validateClipCursor,
} from './list-clips.helper';

@Injectable()
export class ListFolderClipsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(
    userId: string,
    input: ListFolderClipsInput,
  ): Promise<ClipCursorPageOutput> {
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
    });

    await validateClipCursor({
      clipsRepository: this.clipsRepository,
      userId,
      cursor,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
      type,
      q: query,
      searchTarget,
    });

    return buildPage(
      await this.clipsRepository.findClips({
        userId,
        folderId: folder.id,
        workspaceId: folder.workspaceId,
        cursor,
        limit: LIST_CLIPS_LIMIT,
        type,
        q: query,
        searchTarget,
      }),
      LIST_CLIPS_LIMIT,
    );
  }
}
