import {
  ApplicationError,
  ApplicationErrorCode,
} from '../../../shared/application/application.error';

export type FoldersErrorCode = Extract<
  ApplicationErrorCode,
  'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL'
>;

export class FoldersError extends ApplicationError {
  constructor(code: FoldersErrorCode, message: string) {
    super(code, message);
    this.name = 'FoldersError';
  }
}
