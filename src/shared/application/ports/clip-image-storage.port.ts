import type { MulterFile } from 'src/shared/types/multer-file.type';

export const CLIP_IMAGE_STORAGE_PORT = Symbol('CLIP_IMAGE_STORAGE_PORT');

export type UploadClipImageInput = {
  userId: string;
  file: MulterFile;
};

export type UploadedClipImage = {
  key: string;
  url: string;
};

export interface ClipImageStoragePort {
  uploadImage(input: UploadClipImageInput): Promise<UploadedClipImage>;
  deleteImage(imageUrl: string): Promise<void>;
}
