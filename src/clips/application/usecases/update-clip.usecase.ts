import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { Clip } from '../../domain/clip.types';
import type { ClipsRepository } from '../../domain/clips.repository';
import { MulterFile } from 'src/shared/types/multer-file.type';
import { UpdateClipInput } from '../dtos/update-clip-input.dto';
import { ClipsError } from '../errors/clips.error';
import {
  resolveClipData,
  toImageClipData,
  validateClipImageFile,
} from '../helpers/clip-data.helper';
import { CLIP_IMAGE_STORAGE_PORT } from '../ports/clip-image-storage.port';
import type { ClipImageStoragePort } from '../ports/clip-image-storage.port';

@Injectable()
export class UpdateClipUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
    @Inject(CLIP_IMAGE_STORAGE_PORT)
    private readonly clipImageStoragePort: ClipImageStoragePort,
  ) {}

  async execute(
    userId: string,
    input: UpdateClipInput,
    file?: MulterFile,
  ): Promise<Clip> {
    const clip = await this.clipsRepository.findClipByIdForUser(
      userId,
      input.clipId,
    );

    if (!clip) {
      throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    }

    const folder = await this.resolveFolder(userId, input.folderId, clip);
    const clipData =
      !file && !input.text
        ? {
            type: clip.type,
            title: clip.title,
            textContent: clip.textContent,
            colorHex: clip.colorHex,
            imageUrl: clip.imageUrl,
          }
        : file
          ? await this.uploadImageAndResolveClipData(userId, file)
          : resolveClipData(input.text);

    return this.clipsRepository.updateClip(clip.id, {
      ...clipData,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
    });
  }

  private async resolveFolder(
    userId: string,
    folderId: string | undefined,
    clip: Awaited<ReturnType<ClipsRepository['findClipByIdForUser']>>,
  ) {
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

  private async uploadImageAndResolveClipData(
    userId: string,
    file: MulterFile,
  ) {
    validateClipImageFile(file);

    const uploadedImage = await this.clipImageStoragePort.uploadImage({
      userId,
      file,
    });

    return toImageClipData(file, uploadedImage.url);
  }
}
