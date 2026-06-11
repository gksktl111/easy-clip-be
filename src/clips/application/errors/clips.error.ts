import {
  ApplicationError,
  ApplicationErrorCode,
} from '../../../shared/application/application.error';

export type ClipsErrorCode = Extract<
  ApplicationErrorCode,
  'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL'
>;

export class ClipsError extends ApplicationError {
  constructor(code: ClipsErrorCode, message: string) {
    super(code, message);
    this.name = 'ClipsError';
  }
}
