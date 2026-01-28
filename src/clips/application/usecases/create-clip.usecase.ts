import { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';
import { resolveClipData } from '../policies/clip-data.policy';

export type CreateClipInput = {
  folderId: string;
  text?: string;
};

export class CreateClipUseCase {
  constructor(private readonly clipsRepository: ClipsRepository) {}

  async execute(
    userId: string,
    dto: CreateClipInput,
    file?: Express.Multer.File,
  ) {
    const folder = await this.clipsRepository.findPersonalFolderById(
      userId,
      dto.folderId,
    );

    if (!folder) {
      throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const clipData = resolveClipData(dto.text, file);

    return this.clipsRepository.createClip({
      ...clipData,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
    });
  }
}
