import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../errors/folders.error';

export type GetFolderInput =
  | {
      mode: 'single';
      folderId: string;
    }
  | {
      mode: 'list';
    };

@Injectable()
export class GetFolderUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly repo: FoldersRepository,
  ) {}

  async execute(userId: string, input: GetFolderInput) {
    switch (input.mode) {
      case 'single': {
        const folder = await this.repo.findPersonalFolderById(
          userId,
          input.folderId,
        );

        if (!folder) {
          throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
        }

        return folder;
      }
      case 'list': {
        const workspaceId = await this.repo.findPersonalWorkspaceId(userId);

        if (!workspaceId) {
          return [];
        }

        return this.repo.findFoldersByWorkspaceId(workspaceId);
      }
    }
  }
}
