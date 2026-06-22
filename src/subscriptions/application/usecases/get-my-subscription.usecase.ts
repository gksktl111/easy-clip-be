import { Inject, Injectable } from '@nestjs/common';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';
import { normalizeExpiredSubscription } from '../helpers/subscription-expiration.helper';
import { toMySubscriptionResponse } from '../helpers/subscription-response.helper';

@Injectable()
export class GetMySubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async execute(userId: string): Promise<MySubscriptionOutput> {
    const currentSubscription =
      await this.subscriptionsRepository.getOrCreatePersonalSubscription(
        userId,
      );

    const normalizedSubscription = await normalizeExpiredSubscription(
      this.subscriptionsRepository,
      currentSubscription,
    );

    return toMySubscriptionResponse(normalizedSubscription);
  }
}
