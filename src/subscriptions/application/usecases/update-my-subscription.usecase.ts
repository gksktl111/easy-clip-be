import { Inject, Injectable } from '@nestjs/common';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  Subscription,
  SubscriptionAction,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';
import { UpdateMySubscriptionInput } from '../dtos/update-my-subscription-input.dto';
import { SubscriptionsError } from '../errors/subscriptions.error';
import { normalizeExpiredSubscription } from '../helpers/subscription-expiration.helper';
import { toMySubscriptionResponse } from '../helpers/subscription-response.helper';

@Injectable()
export class UpdateMySubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateMySubscriptionInput,
  ): Promise<MySubscriptionOutput> {
    const currentSubscription =
      await this.subscriptionsRepository.getOrCreatePersonalSubscription(
        userId,
      );
    const subscription = await normalizeExpiredSubscription(
      this.subscriptionsRepository,
      currentSubscription,
    );

    if (input.type === SubscriptionAction.CANCEL) {
      return toMySubscriptionResponse(await this.cancel(subscription));
    }

    if (input.type === SubscriptionAction.RESUME) {
      return toMySubscriptionResponse(await this.resume(subscription));
    }

    throw new SubscriptionsError(
      'BAD_REQUEST',
      '지원하지 않는 요청 타입입니다.',
    );
  }

  private async cancel(subscription: Subscription) {
    if (
      subscription.plan !== SubscriptionPlan.PRO ||
      subscription.status !== SubscriptionStatus.ACTIVE
    ) {
      throw new SubscriptionsError(
        'CONFLICT',
        '구독 해지는 PRO ACTIVE 상태에서만 가능합니다.',
      );
    }

    return this.subscriptionsRepository.updateSubscription(subscription.id, {
      status: SubscriptionStatus.CANCELED,
      autoRenew: false,
      nextBillingAt: null,
    });
  }

  private async resume(subscription: Subscription) {
    if (
      subscription.plan !== SubscriptionPlan.PRO ||
      subscription.status !== SubscriptionStatus.CANCELED ||
      !subscription.externalBillingKey ||
      !subscription.externalCustomerKey
    ) {
      throw new SubscriptionsError(
        'CONFLICT',
        '구독 재개는 빌링키가 있는 PRO CANCELED 상태에서만 가능합니다.',
      );
    }

    return this.subscriptionsRepository.updateSubscription(subscription.id, {
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
      nextBillingAt: subscription.currentPeriodEnd,
    });
  }
}
