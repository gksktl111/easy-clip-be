import { FoldersRepository } from '../../domain/folders.repository';

export class GetFoldersUseCase {
  constructor(private readonly foldersRepository: FoldersRepository) {}

  async execute(userId: string) {
    const workspaceId = await this.foldersRepository.findPersonalWorkspaceId(
      userId,
    );

    if (!workspaceId) {
      return [];
    }

    return this.foldersRepository.findFoldersByWorkspaceId(workspaceId);
  }
}
