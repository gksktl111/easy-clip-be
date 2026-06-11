import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import type { FolderTagOutput } from '../dtos/folder-tag-output.dto';
import { UpdateFolderTagInput } from '../dtos/update-folder-tag-input.dto';
import { FoldersError } from '../errors/folders.error';

@Injectable()
export class UpdateFolderTagUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateFolderTagInput,
  ): Promise<FolderTagOutput> {
    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      input.folderId,
    );

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const tag = await this.foldersRepository.findTagByIdInFolder(
      folder.id,
      input.tagId,
    );

    if (!tag) {
      throw new FoldersError('NOT_FOUND', '태그를 찾을 수 없습니다.');
    }

    const duplicatedTag = await this.foldersRepository.findTagByNameInFolder(
      folder.id,
      input.name,
    );

    if (duplicatedTag && duplicatedTag.id !== tag.id) {
      throw new FoldersError('CONFLICT', '이미 존재하는 태그 이름입니다.');
    }

    if (tag.name === input.name) {
      return tag;
    }

    return this.foldersRepository.updateFolderTagName(tag.id, input.name);
  }
}
