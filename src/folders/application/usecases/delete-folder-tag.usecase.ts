import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../errors/folders.error';

@Injectable()
export class DeleteFolderTagUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(
    userId: string,
    folderId: string,
    tagId: string,
  ): Promise<void> {
    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      folderId,
    );

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const tag = await this.foldersRepository.findTagByIdInFolder(
      folder.id,
      tagId,
    );

    if (!tag) {
      throw new FoldersError('NOT_FOUND', '태그를 찾을 수 없습니다.');
    }

    await this.foldersRepository.deleteFolderTag(tag.id);
  }
}
