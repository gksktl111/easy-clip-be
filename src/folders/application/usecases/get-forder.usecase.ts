import { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../folders.error';

export type GetFolderInput =
  | {
      mode: 'single';
      folderId: string;
    }
  | {
      mode: 'list';
    };

export class GetForderUseCase {
  constructor(private readonly repo: FoldersRepository) {}

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
      case 'list':
        const workspaceId = await this.repo.findPersonalWorkspaceId(userId);

        if (!workspaceId) {
          return [];
        }

        return this.repo.findFoldersByWorkspaceId(workspaceId);
    }
  }
}
