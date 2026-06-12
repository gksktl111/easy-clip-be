import {
  ApplicationError,
  ApplicationErrorCode,
} from '../../../shared/application/application.error';

export type WorkspacesErrorCode = Extract<
  ApplicationErrorCode,
  'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL'
>;

export class WorkspacesError extends ApplicationError {
  constructor(code: WorkspacesErrorCode, message: string) {
    super(code, message);
    this.name = 'WorkspacesError';
  }
}
