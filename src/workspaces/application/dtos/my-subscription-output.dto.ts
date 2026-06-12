import type {
  WorkspaceSubscriptionPlan,
  WorkspaceSubscriptionStatus,
} from '../../domain/workspace.types';

export type MySubscriptionOutput = {
  plan: WorkspaceSubscriptionPlan;
  status: WorkspaceSubscriptionStatus;
  autoRenew: boolean;
  currentPeriodEnd: Date | null;
};
