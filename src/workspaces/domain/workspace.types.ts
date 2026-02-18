export const WorkspaceSubscriptionPlan = {
  FREE: 'FREE',
  PRO: 'PRO',
} as const;

export type WorkspaceSubscriptionPlan =
  (typeof WorkspaceSubscriptionPlan)[keyof typeof WorkspaceSubscriptionPlan];

export const WorkspaceSubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  CANCELED: 'CANCELED',
  EXPIRED: 'EXPIRED',
} as const;

export type WorkspaceSubscriptionStatus =
  (typeof WorkspaceSubscriptionStatus)[keyof typeof WorkspaceSubscriptionStatus];

export const WorkspaceSubscriptionAction = {
  CHANGE_PLAN: 'CHANGE_PLAN',
  CANCEL: 'CANCEL',
  RESUME: 'RESUME',
} as const;

export type WorkspaceSubscriptionAction =
  (typeof WorkspaceSubscriptionAction)[keyof typeof WorkspaceSubscriptionAction];

export type WorkspaceSubscription = {
  id: string;
  workspaceId: string;
  plan: WorkspaceSubscriptionPlan;
  status: WorkspaceSubscriptionStatus;
  autoRenew: boolean;
  currentPeriodEnd: Date | null;
  startedAt: Date;
};

export type UpdateMySubscriptionInput = {
  type: WorkspaceSubscriptionAction;
  plan?: WorkspaceSubscriptionPlan;
};

export type MySubscriptionResponse = {
  plan: WorkspaceSubscriptionPlan;
  status: WorkspaceSubscriptionStatus;
  autoRenew: boolean;
  currentPeriodEnd: Date | null;
};
