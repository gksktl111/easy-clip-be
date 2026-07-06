import { SubscriptionPlan } from '../../domain/subscription.types';

export const SUBSCRIPTION_PAYMENT_MAIL_PORT = Symbol(
  'SUBSCRIPTION_PAYMENT_MAIL_PORT',
);

export type SendSubscriptionPaymentSuccessMailInput = {
  recipientEmail: string;
  amount: number;
  currency: string;
  approvedAt: Date;
  plan: SubscriptionPlan;
  currentPeriodEnd: Date;
  nextBillingAt: Date;
  paymentKind: 'INITIAL' | 'AUTO_RENEWAL';
};

export type SendSubscriptionResumedMailInput = {
  recipientEmail: string;
  plan: SubscriptionPlan;
  currentPeriodEnd: Date;
  nextBillingAt: Date;
};

export interface SubscriptionPaymentMailPort {
  sendPaymentSuccess(
    input: SendSubscriptionPaymentSuccessMailInput,
  ): Promise<void>;

  sendSubscriptionResumed(
    input: SendSubscriptionResumedMailInput,
  ): Promise<void>;
}
