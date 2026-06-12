import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import type { FolderTagOutput } from '../dtos/folder-tag-output.dto';
import { FoldersError } from '../errors/folders.error';

@Injectable()
export class ListFolderTagsUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(userId: string, folderId: string): Promise<FolderTagOutput[]> {
    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      folderId,
    );

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    return this.foldersRepository.findTagsByFolderId(folder.id);
  }
}
