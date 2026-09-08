import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { Clip } from '../../domain/clip.types';
import type { UpdatedClip } from '../../domain/clips.repository';
import type { ClipsRepository } from '../../domain/clips.repository';
import { MulterFile } from 'src/shared/types/multer-file.type';
import { UpdateClipInput } from '../dtos/update-clip-input.dto';
import { ClipsError } from '../errors/clips.error';
import {
  resolveClipData,
  toImageClipData,
  validateClipImageFile,
} from '../helpers/clip-data.helper';
import { CLIP_IMAGE_STORAGE_PORT } from 'src/shared/application/ports/clip-image-storage.port';
import type { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';

@Injectable()
export class UpdateClipUseCase {
  private readonly logger = new Logger(UpdateClipUseCase.name);

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
    if ('folderId' in input || 'workspaceId' in input) {
      throw new ClipsError(
        'BAD_REQUEST',
        '클립의 소속 폴더는 변경할 수 없습니다.',
      );
    }
    if (!file && !input.text) {
      throw new ClipsError(
        'BAD_REQUEST',
        'text 또는 file 중 하나는 필요합니다.',
      );
    }
    const clip = await this.clipsRepository.findClipByIdForUser(
      userId,
      input.clipId,
    );
    if (!clip) throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');

    const clipData = file
      ? await this.uploadImageAndResolveClipData(userId, file)
      : resolveClipData(input.text);
    let updated: UpdatedClip | null;
    try {
      updated = await this.clipsRepository.updateClip(
        userId,
        clip.id,
        clipData,
      );
      if (!updated)
        throw new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    } catch (error) {
      if (file && clipData.imageUrl) {
        await this.deleteUnreferencedUpload(clip.id, clipData.imageUrl);
      }
      throw error;
    }
    await this.deletePreviousImageIfReplaced(
      updated.previousImageUrl,
      updated.clip.imageUrl,
    );
    return updated.clip;
  }

  private async deleteUnreferencedUpload(
    clipId: string,
    imageUrl: string,
  ): Promise<void> {
    try {
      if (await this.clipsRepository.isClipImageReferenced(clipId, imageUrl))
        return;
      await this.clipImageStoragePort.deleteImage(imageUrl);
    } catch {
      // DB 결과를 확인할 수 없으면 참조 중일 수 있는 이미지를 삭제하지 않는다.
      this.logger.warn(
        `미사용 업로드 이미지 정리를 완료하지 못했습니다. clipId=${clipId} imageUrl=${imageUrl}`,
      );
    }
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

  private async deletePreviousImageIfReplaced(
    previousImageUrl: string | null,
    nextImageUrl: string | null,
  ): Promise<void> {
    if (!previousImageUrl || previousImageUrl === nextImageUrl) {
      return;
    }

    try {
      await this.clipImageStoragePort.deleteImage(previousImageUrl);
    } catch (error) {
      this.logger.warn(
        `이전 클립 이미지 삭제에 실패했습니다. imageUrl=${previousImageUrl}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
