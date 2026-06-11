import {
  ApplicationError,
  ApplicationErrorCode,
} from '../../../shared/application/application.error';

export type TrashErrorCode = ApplicationErrorCode;

export class TrashError extends ApplicationError {
  constructor(code: TrashErrorCode, message: string) {
    super(code, message);
    this.name = 'TrashError';
  }
}
