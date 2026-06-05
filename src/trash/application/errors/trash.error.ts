import {
  ApplicationError,
  ApplicationErrorCode,
} from '../../../common/application/application.error';

export type TrashErrorCode = ApplicationErrorCode;

export class TrashError extends ApplicationError {
  constructor(code: TrashErrorCode, message: string) {
    super(code, message);
    this.name = 'TrashError';
  }
}
