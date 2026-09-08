import {
  PaymentProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';

export type MySubscriptionOutput = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  autoRenew: boolean;
  currentPeriodEnd: Date | null;
  nextBillingAt: Date | null;
  provider: PaymentProvider | null;
};

export type UpdateMySubscriptionOutput = MySubscriptionOutput & {
  cancellation?: {
    pendingRenewalPayment: boolean;
    message: string;
  };
};
