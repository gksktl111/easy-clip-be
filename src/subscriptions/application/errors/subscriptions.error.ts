import {
  ApplicationError,
  ApplicationErrorCode,
} from '../../../shared/application/application.error';

export type SubscriptionsErrorCode = Extract<
  ApplicationErrorCode,
  'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL'
>;

export class SubscriptionsError extends ApplicationError {
  constructor(code: SubscriptionsErrorCode, message: string) {
    super(code, message);
    this.name = 'SubscriptionsError';
  }
}
