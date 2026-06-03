import { Inject, Injectable } from '@nestjs/common';
import { WORKSPACES_REPOSITORY } from '../../domain/workspaces.repository';
import type { WorkspacesRepository } from '../../domain/workspaces.repository';
import {
  MySubscriptionResponse,
  WorkspaceSubscription,
} from '../../domain/workspace.types';
import { normalizeExpiredSubscription } from '../policies/subscription-expiration.policy';

@Injectable()
export class GetMySubscriptionUseCase {
  constructor(
    @Inject(WORKSPACES_REPOSITORY)
    private readonly workspacesRepository: WorkspacesRepository,
  ) {}

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
