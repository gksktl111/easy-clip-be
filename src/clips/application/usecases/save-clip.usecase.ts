import { ClipsRepository } from '../../domain/clips.repository';
import { ClipsError } from '../clips.error';
import { resolveClipData } from '../policies/clip-data.policy';

export type SaveClipInput =
  | {
      mode: 'create';
      folderId: string;
      text?: string;
    }
  | {
      mode: 'update';
      clipId: string;
      folderId?: string;
      text?: string;
    };

export class SaveClipUseCase {
  constructor(private readonly clipsRepository: ClipsRepository) {}

  async execute(
    userId: string,
    input: SaveClipInput,
    file?: Express.Multer.File,
  ) {
    const isCreate = input.mode === 'create';

    const clip = isCreate
      ? null
      : await this.clipsRepository.findClipByIdForUser(userId, input.clipId);

    if (!isCreate && !clip) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    const folder = await this.resolveFolder(userId, input, clip);
    const clipData = this.resolveClipData(input, clip, file);

    return isCreate
      ? this.clipsRepository.createClip({
          ...clipData,
          folderId: folder.id,
          workspaceId: folder.workspaceId,
        })
      : this.clipsRepository.updateClip(clip!.id, {
          ...clipData,
          folderId: folder.id,
          workspaceId: folder.workspaceId,
        });
  }

  private async resolveFolder(
    userId: string,
    input: SaveClipInput,
    clip: Awaited<ReturnType<ClipsRepository['findClipByIdForUser']>>,
  ) {
    const folderId = input.folderId;

    if (folderId) {
      const folder = await this.clipsRepository.findPersonalFolderById(
        userId,
        folderId,
      );

      if (!folder) {
        throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
      }

      return folder;
    }

    return {
      id: clip!.folderId,
      workspaceId: clip!.workspaceId,
    };
  }

  private resolveClipData(
    input: SaveClipInput,
    clip: Awaited<ReturnType<ClipsRepository['findClipByIdForUser']>>,
    file?: Express.Multer.File,
  ) {
    if (input.mode === 'update' && !file && !input.text) {
      return {
        type: clip!.type,
        title: clip!.title,
        textContent: clip!.textContent,
        colorHex: clip!.colorHex,
        imageUrl: clip!.imageUrl,
      };
    }

    return resolveClipData(input.text, file);
  }
}
