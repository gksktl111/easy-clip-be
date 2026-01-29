import { ClipType } from '../../domain/clip.types';
import { ClipsError } from '../clips.error';
import { DetectedClip, detectClipType } from './clip-type-detector';

export type ClipData = {
  type: ClipType;
  title: string;
  textContent: string | null;
  colorHex: string | null;
  imageUrl: string | null;
};

export function resolveClipData(
  text: string | undefined,
  file?: Express.Multer.File,
): ClipData {
  if (file) {
    if (!file.mimetype.startsWith('image/')) {
      throw new ClipsError(
        'BAD_REQUEST',
        '이미지 파일만 업로드할 수 있습니다.',
      );
    }

    return {
      type: 'IMAGE',
      title: file.originalname,
      textContent: null,
      colorHex: null,
      imageUrl: file.originalname,
    };
  }

  if (!text) {
    throw new ClipsError('BAD_REQUEST', 'text 또는 file 중 하나는 필요합니다.');
  }

  return toClipData(detectClipType(text));
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
