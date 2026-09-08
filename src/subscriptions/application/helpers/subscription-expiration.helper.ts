import { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  Subscription,
  SubscriptionPlan,
} from '../../domain/subscription.types';

export async function normalizeExpiredSubscription(
  subscriptionsRepository: SubscriptionsRepository,
  subscription: Subscription,
): Promise<Subscription> {
  if (!isSubscriptionExpired(subscription)) {
    return subscription;
  }

  return subscriptionsRepository.expireSubscriptionIfUnchanged(
    subscription.id,
    subscription.currentPeriodEnd!,
  );
}

export function isSubscriptionExpired(subscription: Subscription): boolean {
  return (
    subscription.plan === SubscriptionPlan.PRO &&
    !subscription.autoRenew &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd <= new Date()
  );
}
