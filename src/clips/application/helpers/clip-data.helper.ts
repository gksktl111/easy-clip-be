import { ClipType } from '../../domain/clip.types';
import { MulterFile } from 'src/shared/types/multer-file.type';
import { ClipsError } from '../errors/clips.error';
import { DetectedClip, detectClipType } from './clip-type-detector';

export type ClipData = {
  type: ClipType;
  title: string;
  textContent: string | null;
  colorHex: string | null;
  imageUrl: string | null;
};

export const ALLOWED_CLIP_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export function isAllowedClipImageMimeType(mimetype: string): boolean {
  return ALLOWED_CLIP_IMAGE_MIME_TYPES.some((allowed) => allowed === mimetype);
}

export function resolveClipData(text: string | undefined): ClipData {
  if (!text) {
    throw new ClipsError('BAD_REQUEST', 'text 또는 file 중 하나는 필요합니다.');
  }

  return toClipData(detectClipType(text));
}

export function validateClipImageFile(file: MulterFile): void {
  if (!isAllowedClipImageMimeType(file.mimetype)) {
    throw new ClipsError(
      'BAD_REQUEST',
      'jpeg, png, webp, gif, avif 이미지만 업로드할 수 있습니다.',
    );
  }
}

export function toImageClipData(file: MulterFile, imageUrl: string): ClipData {
  return {
    type: 'IMAGE',
    title: normalizeUploadedFileName(file.originalname),
    textContent: null,
    colorHex: null,
    imageUrl,
  };
}

function normalizeUploadedFileName(fileName: string): string {
  const decodedFileName = Buffer.from(fileName, 'latin1').toString('utf8');

  if (
    isLikelyKoreanFileName(decodedFileName) &&
    !isLikelyKoreanFileName(fileName)
  ) {
    return decodedFileName;
  }

  return fileName;
}

function isLikelyKoreanFileName(value: string): boolean {
  return /[가-힣]/.test(value);
}

function toClipData(detected: DetectedClip): ClipData {
  if (detected.type === 'COLOR') {
    return {
      type: 'COLOR',
      title: detected.hex,
      textContent: null,
      colorHex: detected.hex,
      imageUrl: null,
    };
  }

  if (detected.type === 'IMAGE') {
    return {
      type: 'IMAGE',
      title: detected.imageUrl,
      textContent: null,
      colorHex: null,
      imageUrl: detected.imageUrl,
    };
  }

  if (detected.text.length === 0) {
    throw new ClipsError('BAD_REQUEST', 'text는 공백일 수 없습니다.');
  }

  return {
    type: 'TEXT',
    title: detected.text,
    textContent: detected.text,
    colorHex: null,
    imageUrl: null,
  };
}
