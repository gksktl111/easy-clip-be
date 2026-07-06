import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { ImageStorageError } from '../application/errors/image-storage.error';
import { isAllowedClipImageMimeType } from '../application/helpers/clip-image-mime-type.helper';
import type {
  ClipImageStoragePort,
  UploadClipImageInput,
  UploadedClipImage,
} from '../application/ports/clip-image-storage.port';

const DEFAULT_IMAGE_PREFIX = 'clips';
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

@Injectable()
export class R2ClipImageStorageService implements ClipImageStoragePort {
  constructor(private readonly configService: ConfigService) {}

  async uploadImage(input: UploadClipImageInput): Promise<UploadedClipImage> {
    if (!isAllowedClipImageMimeType(input.file.mimetype)) {
      throw new ImageStorageError(
        'BAD_REQUEST',
        'jpeg, png, webp, gif, avif 이미지만 업로드할 수 있습니다.',
      );
    }

    const maxImageBytes = this.resolveMaxImageBytes();

    if (input.file.size > maxImageBytes) {
      throw new ImageStorageError(
        'BAD_REQUEST',
        `이미지 파일은 ${maxImageBytes} bytes 이하여야 합니다.`,
      );
    }

    const imagePrefix =
      this.configService.get<string>('R2_IMAGE_PREFIX') ?? DEFAULT_IMAGE_PREFIX;
    const key = `${imagePrefix}/${input.userId}/${randomUUID()}${this.resolveExtension(input.file)}`;
    const client = this.createClient();
    const bucketName = this.getRequired('R2_BUCKET_NAME');
    const publicBaseUrl = this.resolvePublicBaseUrl();

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: input.file.buffer,
          ContentType: input.file.mimetype,
        }),
      );
    } catch {
      throw new ImageStorageError(
        'INTERNAL',
        '이미지 업로드 중 오류가 발생했습니다.',
      );
    }

    return {
      key,
      url: `${publicBaseUrl}/${key}`,
    };
  }

  async deleteImage(imageUrl: string): Promise<void> {
    const key = this.resolveKeyFromImageUrl(imageUrl);

    if (!key) {
      return;
    }

    const client = this.createClient();
    const bucketName = this.getRequired('R2_BUCKET_NAME');

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
    } catch {
      throw new ImageStorageError(
        'INTERNAL',
        '이미지 삭제 중 오류가 발생했습니다.',
      );
    }
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new Error(`${key} 환경 변수가 필요합니다.`);
    }

    return value;
  }

  private resolveExtension(file: UploadClipImageInput['file']): string {
    const mimeExtension = MIME_EXTENSION_MAP[file.mimetype];

    if (mimeExtension) {
      return mimeExtension;
    }

    const originalExtension = extname(file.originalname).toLowerCase();

    if (originalExtension) {
      return originalExtension;
    }

    return '';
  }

  private resolveMaxImageBytes(): number {
    const rawValue = this.configService.get<string>('R2_MAX_IMAGE_BYTES');

    if (!rawValue) {
      return DEFAULT_MAX_IMAGE_BYTES;
    }

    const parsedValue = Number(rawValue);

    return Number.isFinite(parsedValue) && parsedValue > 0
      ? parsedValue
      : DEFAULT_MAX_IMAGE_BYTES;
  }

  private resolvePublicBaseUrl(): string {
    return this.getRequired('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
  }

  private resolveKeyFromImageUrl(imageUrl: string): string | null {
    const publicBaseUrl = this.resolvePublicBaseUrl();
    const prefix = `${publicBaseUrl}/`;

    if (!imageUrl.startsWith(prefix)) {
      return null;
    }

    const key = imageUrl.slice(prefix.length);

    return key.length > 0 ? decodeURIComponent(key) : null;
  }

  private createClient(): S3Client {
    const accountId = this.getRequired('R2_ACCOUNT_ID');
    const accessKeyId = this.getRequired('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.getRequired('R2_SECRET_ACCESS_KEY');

    return new S3Client({
      region: 'auto',
      endpoint:
        this.configService.get<string>('R2_ENDPOINT') ??
        `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
}
