import { WorkspacesRepository } from '../../domain/workspaces.repository';
import {
  WorkspaceSubscription,
  WorkspaceSubscriptionPlan,
  WorkspaceSubscriptionStatus,
} from '../../domain/workspace.types';

export async function normalizeExpiredSubscription(
  workspacesRepository: WorkspacesRepository,
  subscription: WorkspaceSubscription,
): Promise<WorkspaceSubscription> {
  if (!isCanceledSubscriptionExpired(subscription)) {
    return subscription;
  }

  return workspacesRepository.updateWorkspaceSubscription(subscription.id, {
    plan: WorkspaceSubscriptionPlan.FREE,
    status: WorkspaceSubscriptionStatus.EXPIRED,
    autoRenew: false,
  });
}

export function isCanceledSubscriptionExpired(
  subscription: WorkspaceSubscription,
): boolean {
  return (
    subscription.plan === WorkspaceSubscriptionPlan.PRO &&
    subscription.status === WorkspaceSubscriptionStatus.CANCELED &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd <= new Date()
  );
}
