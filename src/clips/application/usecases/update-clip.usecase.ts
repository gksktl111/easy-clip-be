import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../errors/clips.error';
import { resolveClipData } from '../policies/clip-data.policy';

export type UpdateClipInput = {
  clipId: string;
  folderId?: string;
  text?: string;
};

@Injectable()
export class UpdateClipUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateClipInput,
    file?: Express.Multer.File,
  ) {
    const clip = await this.clipsRepository.findClipByIdForUser(
      userId,
      input.clipId,
    );

    if (!clip) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    const folder = await this.resolveFolder(userId, input.folderId, clip);
    const clipData =
      !file && !input.text
        ? {
            type: clip.type,
            title: clip.title,
            textContent: clip.textContent,
            colorHex: clip.colorHex,
            imageUrl: clip.imageUrl,
          }
        : resolveClipData(input.text, file);

    return this.clipsRepository.updateClip(clip.id, {
      ...clipData,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
    });
  }

  private async resolveFolder(
    userId: string,
    folderId: string | undefined,
    clip: Awaited<ReturnType<ClipsRepository['findClipByIdForUser']>>,
  ) {
    if (folderId) {
      const folder = await this.clipsRepository.findPersonalFolderById(
        userId,
        folderId,
      );

      if (!folder) {
        throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
      }

      return folder;
    }

    return {
      id: clip!.folderId,
      workspaceId: clip!.workspaceId,
    };
  }
}
