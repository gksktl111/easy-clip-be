import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';

@Injectable()
export class CreateFolderUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(userId: string, name: string) {
    const workspaceId =
      await this.foldersRepository.getOrCreatePersonalWorkspaceId(userId);

    const lastOrder =
      await this.foldersRepository.findLastFolderOrder(workspaceId);
    const nextOrder = lastOrder ? lastOrder + 1 : 1;

    return this.foldersRepository.createFolder({
      name,
      order: nextOrder,
      workspaceId,
    });
  }
}
