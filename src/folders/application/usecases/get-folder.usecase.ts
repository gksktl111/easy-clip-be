import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { FolderOutput } from '../dtos/folder-output.dto';
import { FoldersError } from '../errors/folders.error';

@Injectable()
export class GetFolderUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly repo: FoldersRepository,
  ) {}

  async execute(userId: string, folderId: string): Promise<FolderOutput> {
    const folder = await this.repo.findPersonalFolderById(userId, folderId);

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    return folder;
  }
}
