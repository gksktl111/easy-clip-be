import { WorkspacesRepository } from '../../domain/workspaces.repository';
import {
  MySubscriptionResponse,
  WorkspaceSubscription,
  WorkspaceSubscriptionPlan,
  WorkspaceSubscriptionStatus,
} from '../../domain/workspace.types';

export class GetMySubscriptionUseCase {
  constructor(private readonly workspacesRepository: WorkspacesRepository) {}

  async execute(userId: string): Promise<MySubscriptionResponse> {
    const currentSubscription =
      await this.workspacesRepository.getOrCreatePersonalWorkspaceSubscription(
        userId,
      );

    const normalizedSubscription =
      await this.expireIfPastPeriodEnd(currentSubscription);

    return this.toResponse(normalizedSubscription);
  }

  private async expireIfPastPeriodEnd(subscription: WorkspaceSubscription) {
    if (!this.isCanceledSubscriptionExpired(subscription)) {
      return subscription;
    }

    return this.workspacesRepository.updateWorkspaceSubscription(
      subscription.id,
      {
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.EXPIRED,
        autoRenew: false,
      },
    );
  }

  private isCanceledSubscriptionExpired(subscription: WorkspaceSubscription) {
    return (
      subscription.plan === WorkspaceSubscriptionPlan.PRO &&
      subscription.status === WorkspaceSubscriptionStatus.CANCELED &&
      subscription.currentPeriodEnd !== null &&
      subscription.currentPeriodEnd <= new Date()
    );
  }

  private toResponse(
    subscription: WorkspaceSubscription,
  ): MySubscriptionResponse {
    return {
      plan: subscription.plan,
      status: subscription.status,
      autoRenew: subscription.autoRenew,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }
}
