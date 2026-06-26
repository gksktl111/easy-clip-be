import { ApplicationError, ApplicationErrorCode } from '../application.error';

export type ImageStorageErrorCode = Extract<
  ApplicationErrorCode,
  'BAD_REQUEST' | 'INTERNAL'
>;

export class ImageStorageError extends ApplicationError {
  constructor(code: ImageStorageErrorCode, message: string) {
    super(code, message);
    this.name = 'ImageStorageError';
  }
}
