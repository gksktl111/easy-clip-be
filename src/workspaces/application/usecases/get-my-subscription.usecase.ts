import { WorkspacesRepository } from '../../domain/workspaces.repository';
import {
  MySubscriptionResponse,
  WorkspaceSubscription,
} from '../../domain/workspace.types';
import { normalizeExpiredSubscription } from '../policies/subscription-expiration.policy';

export class GetMySubscriptionUseCase {
  constructor(private readonly workspacesRepository: WorkspacesRepository) {}

  async execute(userId: string): Promise<MySubscriptionResponse> {
    const currentSubscription =
      await this.workspacesRepository.getOrCreatePersonalWorkspaceSubscription(
        userId,
      );

    const normalizedSubscription = await normalizeExpiredSubscription(
      this.workspacesRepository,
      currentSubscription,
    );

    return this.toResponse(normalizedSubscription);
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
