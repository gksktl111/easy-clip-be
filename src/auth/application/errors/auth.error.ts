import {
  ApplicationError,
  ApplicationErrorCode,
} from '../../../shared/application/application.error';

export type AuthErrorCode = ApplicationErrorCode;

export class AuthError extends ApplicationError {
  constructor(code: AuthErrorCode, message: string) {
    super(code, message);
    this.name = 'AuthError';
  }
}
