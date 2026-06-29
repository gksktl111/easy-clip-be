import { Inject, Injectable } from '@nestjs/common';
import { CLIPS_REPOSITORY } from '../../domain/clips.repository';
import type { Clip } from '../../domain/clip.types';
import type { ClipsRepository } from '../../domain/clips.repository';
import { MulterFile } from 'src/shared/types/multer-file.type';
import { CreateClipInput } from '../dtos/create-clip-input.dto';
import { ClipsError } from '../errors/clips.error';
import {
  resolveClipData,
  toImageClipData,
  validateClipImageFile,
} from '../helpers/clip-data.helper';
import { CLIP_IMAGE_STORAGE_PORT } from 'src/shared/application/ports/clip-image-storage.port';
import type { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';

@Injectable()
export class CreateClipUseCase {
  constructor(
    @Inject(CLIPS_REPOSITORY)
    private readonly clipsRepository: ClipsRepository,
    @Inject(CLIP_IMAGE_STORAGE_PORT)
    private readonly clipImageStoragePort: ClipImageStoragePort,
  ) {}

  async execute(
    userId: string,
    input: CreateClipInput,
    file?: MulterFile,
  ): Promise<Clip> {
    const folder = await this.clipsRepository.findPersonalFolderById(
      userId,
      input.folderId,
    );

    if (!folder) {
      throw new ClipsError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    }

    const clipData = file
      ? await this.uploadImageAndResolveClipData(userId, file)
      : resolveClipData(input.text);

    return this.clipsRepository.createClip({
      ...clipData,
      folderId: folder.id,
      workspaceId: folder.workspaceId,
    });
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
