import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../errors/clips.error';
import { resolveClipData } from '../policies/clip-data.policy';

export type CreateClipInput = {
  folderId: string;
  text?: string;
};

@Injectable()
export class CreateClipUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(
    userId: string,
    input: CreateClipInput,
    file?: Express.Multer.File,
  ) {
    const folder = await this.clipsRepository.findPersonalFolderById(
      userId,
      input.folderId,
    );

    if (!folder) {
      throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const clipData = resolveClipData(input.text, file);

    return this.clipsRepository.createClip({
      ...clipData,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
    });
  }
}
