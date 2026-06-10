import { Inject, Injectable } from '@nestjs/common';
import { WORKSPACES_REPOSITORY } from '../../domain/workspaces.repository';
import type { WorkspacesRepository } from '../../domain/workspaces.repository';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';
import { UpdateMySubscriptionInput } from '../dtos/update-my-subscription-input.dto';
import { normalizeExpiredSubscription } from '../policies/subscription-expiration.policy';
import { toMySubscriptionResponse } from '../policies/subscription-response.policy';
import {
  buildSubscriptionUpdateParams,
  validateUpdateMySubscriptionInput,
} from '../policies/update-subscription.policy';

@Injectable()
export class UpdateMySubscriptionUseCase {
  constructor(
    @Inject(WORKSPACES_REPOSITORY)
    private readonly workspacesRepository: WorkspacesRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateMySubscriptionInput,
  ): Promise<MySubscriptionOutput> {
    validateUpdateMySubscriptionInput(input);

    const currentSubscription =
      await this.workspacesRepository.getOrCreatePersonalWorkspaceSubscription(
        userId,
      );

    const normalizedSubscription = await normalizeExpiredSubscription(
      this.workspacesRepository,
      currentSubscription,
    );

    const updated = await this.workspacesRepository.updateWorkspaceSubscription(
      normalizedSubscription.id,
      buildSubscriptionUpdateParams(normalizedSubscription, input),
    );

    return toMySubscriptionResponse(updated);
  }
}
