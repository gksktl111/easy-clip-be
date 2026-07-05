import { Inject, Injectable, Logger } from '@nestjs/common';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  Subscription,
  SubscriptionAction,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';
import { SUBSCRIPTION_PAYMENT_MAIL_PORT } from '../ports/subscription-payment-mail.port';
import type { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';
import { UpdateMySubscriptionInput } from '../dtos/update-my-subscription-input.dto';
import { SubscriptionsError } from '../errors/subscriptions.error';
import { normalizeExpiredSubscription } from '../helpers/subscription-expiration.helper';
import { toMySubscriptionResponse } from '../helpers/subscription-response.helper';

@Injectable()
export class UpdateMySubscriptionUseCase {
  private readonly logger = new Logger(UpdateMySubscriptionUseCase.name);

  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: SubscriptionsRepository,
    @Inject(SUBSCRIPTION_PAYMENT_MAIL_PORT)
    private readonly subscriptionPaymentMailPort: SubscriptionPaymentMailPort,
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
      const updated = await this.resume(subscription);
      await this.sendSubscriptionResumedMail(userId, updated);

      return toMySubscriptionResponse(updated);
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

  private async sendSubscriptionResumedMail(
    userId: string,
    subscription: Subscription,
  ): Promise<void> {
    if (!subscription.currentPeriodEnd || !subscription.nextBillingAt) {
      return;
    }

    try {
      const recipient =
        await this.subscriptionsRepository.findBillingMailRecipientByUserId(
          userId,
        );

      if (!recipient) {
        this.logger.warn(
          `구독 재개 메일 수신자를 찾지 못했습니다. userId=${userId}`,
        );
        return;
      }

      // 재개는 즉시 과금이 아니므로 결제 성공 메일과 분리해 다음 결제 예정일만 안내한다.
      await this.subscriptionPaymentMailPort.sendSubscriptionResumed({
        recipientEmail: recipient.email,
        plan: SubscriptionPlan.PRO,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingAt: subscription.nextBillingAt,
      });
    } catch (error) {
      this.logger.warn(
        `구독 재개 메일 발송에 실패했습니다. userId=${userId} error=${resolveErrorName(error)}`,
      );
    }
  }
}

function resolveErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
