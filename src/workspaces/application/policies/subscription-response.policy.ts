import {
  MySubscriptionResponse,
  WorkspaceSubscription,
} from '../../domain/workspace.types';

export function toMySubscriptionResponse(
  subscription: WorkspaceSubscription,
): MySubscriptionResponse {
  return {
    plan: subscription.plan,
    status: subscription.status,
    autoRenew: subscription.autoRenew,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}
