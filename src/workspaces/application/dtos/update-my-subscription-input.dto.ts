import type {
  WorkspaceSubscriptionAction,
  WorkspaceSubscriptionPlan,
} from '../../domain/workspace.types';

export type UpdateMySubscriptionInput = {
  type: WorkspaceSubscriptionAction;
  plan?: WorkspaceSubscriptionPlan;
};
