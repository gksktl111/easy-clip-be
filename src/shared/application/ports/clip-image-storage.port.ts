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
  // 각 업로드는 새 객체와 고유 URL을 생성하며 기존 객체 URL을 재사용하지 않는다.
  uploadImage(input: UploadClipImageInput): Promise<UploadedClipImage>;
  deleteImage(imageUrl: string): Promise<void>;
}
