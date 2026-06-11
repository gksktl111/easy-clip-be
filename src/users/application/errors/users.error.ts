import {
  ApplicationError,
  ApplicationErrorCode,
} from '../../../shared/application/application.error';

export type UsersErrorCode = Extract<
  ApplicationErrorCode,
  'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL'
>;

export class UsersError extends ApplicationError {
  constructor(code: UsersErrorCode, message: string) {
    super(code, message);
    this.name = 'UsersError';
  }
}
