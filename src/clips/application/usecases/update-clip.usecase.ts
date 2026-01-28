import { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';
import { resolveClipData } from '../policies/clip-data.policy';

export type UpdateClipInput = {
  folderId?: string;
  text?: string;
};

export class UpdateClipUseCase {
  constructor(private readonly clipsRepository: ClipsRepository) {}

  async execute(
    userId: string,
    clipId: string,
    dto: UpdateClipInput,
    file?: Express.Multer.File,
  ) {
    const clip = await this.clipsRepository.findClipByIdForUser(userId, clipId);

    if (!clip) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    const nextFolder = dto.folderId
      ? await this.clipsRepository.findPersonalFolderById(userId, dto.folderId)
      : { id: clip.folderId, workspaceId: clip.workspaceId };

    if (!nextFolder) {
      throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const clipData =
      file || dto.text
        ? resolveClipData(dto.text, file)
        : {
            type: clip.type,
            title: clip.title,
            textContent: clip.textContent,
            colorHex: clip.colorHex,
            imageUrl: clip.imageUrl,
          };

    return this.clipsRepository.updateClip(clip.id, {
      ...clipData,
      folderId: nextFolder.id,
      workspaceId: nextFolder.workspaceId,
    });
  }
}
