export const SubscriptionPlan = {
  FREE: 'FREE',
  PRO: 'PRO',
} as const;

export type SubscriptionPlan =
  (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  CANCELED: 'CANCELED',
  EXPIRED: 'EXPIRED',
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentProvider = {
  TOSS_PAYMENTS: 'TOSS_PAYMENTS',
} as const;

export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const SubscriptionPaymentStatus = {
  PENDING: 'PENDING',
  DONE: 'DONE',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
} as const;

export type SubscriptionPaymentStatus =
  (typeof SubscriptionPaymentStatus)[keyof typeof SubscriptionPaymentStatus];

export const SubscriptionAction = {
  CANCEL: 'CANCEL',
  RESUME: 'RESUME',
} as const;

export type SubscriptionAction =
  (typeof SubscriptionAction)[keyof typeof SubscriptionAction];

export type Subscription = {
  id: string;
  workspaceId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  autoRenew: boolean;
  startedAt: Date;
  currentPeriodEnd: Date | null;
  nextBillingAt: Date | null;
  provider: PaymentProvider | null;
  externalBillingKey: string | null;
  externalCustomerKey: string | null;
};

export type SubscriptionPayment = {
  id: string;
  subscriptionId: string;
  provider: PaymentProvider;
  status: SubscriptionPaymentStatus;
  externalPaymentKey: string | null;
  externalOrderId: string;
  externalEventId: string | null;
  amount: number;
  currency: string;
  approvedAt: Date | null;
  failedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
};
