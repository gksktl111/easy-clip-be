import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { CreateFolderInput } from '../dtos/create-folder-input.dto';
import { FolderOutput } from '../dtos/folder-output.dto';

@Injectable()
export class CreateFolderUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(
    userId: string,
    input: CreateFolderInput,
  ): Promise<FolderOutput> {
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
}
