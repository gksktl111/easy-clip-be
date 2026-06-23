import { Subscription } from '../../domain/subscription.types';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';

export function toMySubscriptionResponse(
  subscription: Subscription,
): MySubscriptionOutput {
  return {
    plan: subscription.plan,
    status: subscription.status,
    autoRenew: subscription.autoRenew,
    currentPeriodEnd: subscription.currentPeriodEnd,
    nextBillingAt: subscription.nextBillingAt,
    provider: subscription.provider,
  };
}
