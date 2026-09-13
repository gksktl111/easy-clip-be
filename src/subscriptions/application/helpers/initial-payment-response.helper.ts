import { InitialPaymentAttempt } from '../../domain/subscriptions.repository';
import { InitialPaymentOutput } from '../dtos/initial-payment-output.dto';

export function initialPaymentOutput(
  attempt: InitialPaymentAttempt,
): InitialPaymentOutput {
  return {
    attemptId: attempt.id,
    status: attempt.status,
    amount: attempt.amount,
    currency: attempt.currency,
    priceVersion: attempt.priceVersion,
  };
}
