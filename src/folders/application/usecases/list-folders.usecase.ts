import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { FolderOutput } from '../dtos/folder-output.dto';

@Injectable()
export class ListFoldersUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly repo: FoldersRepository,
  ) {}

  async execute(userId: string): Promise<FolderOutput[]> {
    const workspaceId = await this.repo.findPersonalWorkspaceId(userId);

    if (!workspaceId) {
      return [];
    }

    return this.repo.findFoldersByWorkspaceId(workspaceId);
  }
}
