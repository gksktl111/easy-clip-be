import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import type { ReplaceClipTagsInput } from '../dtos/replace-clip-tags-input.dto';
import type { ReplaceClipTagsOutput } from '../dtos/replace-clip-tags-output.dto';
import { ClipsError } from '../errors/clips.error';
import { isValidTagName } from 'src/shared/application/tag-name.helper';

@Injectable()
export class ReplaceClipTagsUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
  ) {}

  async execute(
    userId: string,
    input: ReplaceClipTagsInput,
  ): Promise<ReplaceClipTagsOutput> {
    const clip = await this.clipsRepository.findClipByIdForUser(
      userId,
      input.clipId,
    );

    if (!clip) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    const tagNames = [...new Set(input.tags)];

    if (tagNames.some((tagName) => !isValidTagName(tagName))) {
      throw new ClipsError(
        'BAD_REQUEST',
        '태그명은 공백만으로 구성할 수 없으며 공백을 포함해 10자 이하여야 합니다.',
      );
    }

    const tags = await this.clipsRepository.replaceClipTags({
      clipId: clip.id,
      folderId: clip.folderId,
      tagNames,
    });

    return {
      tags,
    };
  }
}
