import { Inject, Injectable } from '@nestjs/common';
import { WORKSPACES_REPOSITORY } from '../../domain/workspaces.repository';
import type { WorkspacesRepository } from '../../domain/workspaces.repository';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';
import { normalizeExpiredSubscription } from '../policies/subscription-expiration.policy';
import { toMySubscriptionResponse } from '../policies/subscription-response.policy';

@Injectable()
export class GetMySubscriptionUseCase {
  constructor(
    @Inject(WORKSPACES_REPOSITORY)
    private readonly workspacesRepository: WorkspacesRepository,
  ) {}

  async execute(userId: string): Promise<MySubscriptionOutput> {
    const currentSubscription =
      await this.workspacesRepository.getOrCreatePersonalWorkspaceSubscription(
        userId,
      );

    const normalizedSubscription = await normalizeExpiredSubscription(
      this.workspacesRepository,
      currentSubscription,
    );

    return toMySubscriptionResponse(normalizedSubscription);
  }
}
