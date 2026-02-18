import {
  WorkspaceSubscription,
  WorkspaceSubscriptionPlan,
  WorkspaceSubscriptionStatus,
} from './workspace.types';

export const WORKSPACES_REPOSITORY = Symbol('WORKSPACES_REPOSITORY');

export type UpdateWorkspaceSubscriptionParams = {
  plan?: WorkspaceSubscriptionPlan;
  status?: WorkspaceSubscriptionStatus;
  autoRenew?: boolean;
  currentPeriodEnd?: Date | null;
};

export interface WorkspacesRepository {
  getOrCreatePersonalWorkspaceSubscription(
    userId: string,
  ): Promise<WorkspaceSubscription>;

  updateWorkspaceSubscription(
    subscriptionId: string,
    params: UpdateWorkspaceSubscriptionParams,
  ): Promise<WorkspaceSubscription>;
}
