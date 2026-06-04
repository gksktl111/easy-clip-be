import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';

@Injectable()
export class ListFoldersUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly repo: FoldersRepository,
  ) {}

  async execute(userId: string) {
    const workspaceId = await this.repo.findPersonalWorkspaceId(userId);

    if (!workspaceId) {
      return [];
    }

    return this.repo.findFoldersByWorkspaceId(workspaceId);
  }
}
