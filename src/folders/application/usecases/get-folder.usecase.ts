import { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../folders.error';

export class GetFolderUseCase {
  constructor(private readonly foldersRepository: FoldersRepository) {}

  async execute(userId: string, folderId: string) {
    const folder = await this.foldersRepository.findPersonalFolderById(
      userId,
      folderId,
    );

    if (!folder) {
      throw new FoldersError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    return folder;
  }
}
