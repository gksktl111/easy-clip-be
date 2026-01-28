import { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../folders.error';

export type UpdateFolderInput = {
  name?: string;
};

export class UpdateFolderUseCase {
  constructor(private readonly foldersRepository: FoldersRepository) {}

  async execute(userId: string, folderId: string, input: UpdateFolderInput) {
    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      folderId,
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
