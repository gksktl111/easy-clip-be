import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import type { FolderTagOutput } from '../dtos/folder-tag-output.dto';
import { CreateFolderTagInput } from '../dtos/create-folder-tag-input.dto';
import { FoldersError } from '../errors/folders.error';
import { normalizeFolderTagName } from '../helpers/folder-name.helper';

@Injectable()
export class CreateFolderTagUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(
    userId: string,
    input: CreateFolderTagInput,
  ): Promise<FolderTagOutput> {
    const name = normalizeFolderTagName(input.name);
    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      input.folderId,
    );

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const existingTag = await this.foldersRepository.findTagByNameInFolder(
      folder.id,
      name,
    );

    if (existingTag) {
      throw new FoldersError('CONFLICT', '이미 존재하는 태그 이름입니다.');
    }

    return this.foldersRepository.createFolderTag({
      folderId: folder.id,
      name,
    });
  }
}
