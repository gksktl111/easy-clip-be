import { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';

export async function normalizeExpiredSubscription(
  subscriptionsRepository: SubscriptionsRepository,
  subscription: Subscription,
): Promise<Subscription> {
  if (!isSubscriptionExpired(subscription)) {
    return subscription;
  }

  return subscriptionsRepository.updateSubscription(subscription.id, {
    plan: SubscriptionPlan.FREE,
    status: SubscriptionStatus.EXPIRED,
    autoRenew: false,
    nextBillingAt: null,
  });
}

export function isSubscriptionExpired(subscription: Subscription): boolean {
  return (
    subscription.plan === SubscriptionPlan.PRO &&
    !subscription.autoRenew &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd <= new Date()
  );
}
