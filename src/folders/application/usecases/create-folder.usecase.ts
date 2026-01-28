import { FoldersRepository } from '../../domain/folders.repository';

export type CreateFolderInput = {
  name: string;
};

export class CreateFolderUseCase {
  constructor(private readonly foldersRepository: FoldersRepository) {}

  async execute(userId: string, input: CreateFolderInput) {
    const workspaceId =
      await this.foldersRepository.getOrCreatePersonalWorkspaceId(userId);

    const lastOrder = await this.foldersRepository.findLastFolderOrder(
      workspaceId,
    );
    const nextOrder = lastOrder ? lastOrder + 1 : 1;

    return this.foldersRepository.createFolder({
      name: input.name,
      order: nextOrder,
      workspaceId,
    });
  }
}
