import {
  PaymentProvider,
  Subscription,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from './subscription.types';

export const SUBSCRIPTIONS_REPOSITORY = Symbol('SUBSCRIPTIONS_REPOSITORY');

export type UpdateSubscriptionParams = {
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  autoRenew?: boolean;
  currentPeriodEnd?: Date | null;
  nextBillingAt?: Date | null;
  provider?: PaymentProvider | null;
  externalBillingKey?: string | null;
  externalCustomerKey?: string | null;
};

export type RecordSubscriptionPaymentParams = {
  subscriptionId: string;
  provider: PaymentProvider;
  status: SubscriptionPaymentStatus;
  externalPaymentKey?: string | null;
  externalOrderId: string;
  externalEventId?: string | null;
  amount: number;
  currency: string;
  approvedAt?: Date | null;
  failedAt?: Date | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  rawData?: unknown;
};

export type ActivateSubscriptionPaymentParams =
  RecordSubscriptionPaymentParams & {
    externalBillingKey: string;
    externalCustomerKey: string;
    startedAt: Date;
    currentPeriodEnd: Date;
    nextBillingAt: Date;
  };

export type MarkPaymentFailedParams = RecordSubscriptionPaymentParams;

export type ClaimAutoRenewalPaymentParams = {
  subscriptionId: string;
  provider: PaymentProvider;
  externalOrderId: string;
  amount: number;
  currency: string;
};

export type BillingMailRecipient = {
  email: string;
};

export interface SubscriptionsRepository {
  getOrCreatePersonalSubscription(userId: string): Promise<Subscription>;

  findBillingMailRecipientByUserId(
    userId: string,
  ): Promise<BillingMailRecipient | null>;

  findBillingMailRecipientBySubscriptionId(
    subscriptionId: string,
  ): Promise<BillingMailRecipient | null>;

  updateSubscription(
    subscriptionId: string,
    params: UpdateSubscriptionParams,
  ): Promise<Subscription>;

  activateByPayment(
    params: ActivateSubscriptionPaymentParams,
  ): Promise<Subscription>;

  recordPaymentFailure(params: MarkPaymentFailedParams): Promise<void>;

  claimAutoRenewalPayment(
    params: ClaimAutoRenewalPaymentParams,
  ): Promise<boolean>;

  findDueAutoRenewalSubscriptions(
    now: Date,
    limit: number,
  ): Promise<Subscription[]>;
}
