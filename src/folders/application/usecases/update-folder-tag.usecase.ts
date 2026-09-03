import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import type { FolderTagOutput } from '../dtos/folder-tag-output.dto';
import { UpdateFolderTagInput } from '../dtos/update-folder-tag-input.dto';
import { FoldersError } from '../errors/folders.error';
import { resolveFolderTagBackgroundColor } from '../helpers/folder-tag-background-color.helper';
import { normalizeFolderTagName } from '../helpers/folder-name.helper';

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
    const name =
      input.name === undefined ? undefined : normalizeFolderTagName(input.name);
    const backgroundColor =
      input.backgroundColor === undefined
        ? undefined
        : resolveFolderTagBackgroundColor(input.backgroundColor);

    if (name === undefined && backgroundColor === undefined) {
      throw new FoldersError(
        'BAD_REQUEST',
        '수정할 태그 이름 또는 배경색을 입력해야 합니다.',
      );
    }

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

    const nameChanged = name !== undefined && name !== tag.name;
    const backgroundColorChanged =
      backgroundColor !== undefined && backgroundColor !== tag.backgroundColor;

    if (nameChanged) {
      const duplicatedTag = await this.foldersRepository.findTagByNameInFolder(
        folder.id,
        name,
      );

      if (duplicatedTag && duplicatedTag.id !== tag.id) {
        throw new FoldersError('CONFLICT', '이미 존재하는 태그 이름입니다.');
      }
    }

    if (!nameChanged && !backgroundColorChanged) {
      return tag;
    }

    return this.foldersRepository.updateFolderTag(tag.id, {
      ...(nameChanged ? { name } : {}),
      ...(backgroundColorChanged ? { backgroundColor } : {}),
    });
  }
}
