import { MySubscriptionOutput } from './my-subscription-output.dto';

export type InitialPaymentOutput = {
  attemptId: string | null;
  status: 'PENDING' | 'DONE' | 'FAILED' | 'CANCELED';
  amount?: number;
  currency?: string;
  priceVersion?: string;
  subscription?: MySubscriptionOutput;
};
