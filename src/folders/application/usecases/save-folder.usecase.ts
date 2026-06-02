import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../folders.error';

export type SaveFolderInput =
  | {
      mode: 'create';
      name: string;
    }
  | {
      mode: 'update';
      folderId: string;
      name?: string;
    };

@Injectable()
export class SaveFolderUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(userId: string, input: SaveFolderInput) {
    if (input.mode === 'create') {
      const workspaceId =
        await this.foldersRepository.getOrCreatePersonalWorkspaceId(userId);

      const lastOrder =
        await this.foldersRepository.findLastFolderOrder(workspaceId);
      const nextOrder = lastOrder ? lastOrder + 1 : 1;

      return this.foldersRepository.createFolder({
        name: input.name,
        order: nextOrder,
        workspaceId,
      });
    }

    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      input.folderId,
    );

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    if (!input.name) {
      return folder;
    }

    return this.foldersRepository.updateFolderName(folder.id, input.name);
  }
}
