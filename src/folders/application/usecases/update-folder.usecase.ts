import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { FolderOutput } from '../dtos/folder-output.dto';
import { UpdateFolderInput } from '../dtos/update-folder-input.dto';
import { FoldersError } from '../errors/folders.error';
import { normalizeFolderName } from '../helpers/folder-name.helper';

@Injectable()
export class UpdateFolderUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateFolderInput,
  ): Promise<FolderOutput> {
    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      input.folderId,
    );

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    if (input.name === undefined) {
      return folder;
    }

    const name = normalizeFolderName(input.name);

    return this.foldersRepository.updateFolderName(folder.id, name);
  }
}
