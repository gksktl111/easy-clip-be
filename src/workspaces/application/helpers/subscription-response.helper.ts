import { WorkspaceSubscription } from '../../domain/workspace.types';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';

export function toMySubscriptionResponse(
  subscription: WorkspaceSubscription,
): MySubscriptionOutput {
  return {
    plan: subscription.plan,
    status: subscription.status,
    autoRenew: subscription.autoRenew,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}
