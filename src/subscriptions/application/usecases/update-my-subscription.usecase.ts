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
import { UpdateMySubscriptionOutput } from '../dtos/my-subscription-output.dto';
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
  ): Promise<UpdateMySubscriptionOutput> {
    const currentSubscription =
      await this.subscriptionsRepository.getOrCreatePersonalSubscription(
        userId,
      );
    const subscription = await normalizeExpiredSubscription(
      this.subscriptionsRepository,
      currentSubscription,
    );

    if (input.type === SubscriptionAction.CANCEL) {
      const canceled = await this.subscriptionsRepository.cancelAutoRenewal(
        subscription.id,
      );
      if (!canceled)
        throw new SubscriptionsError(
          'CONFLICT',
          '현재 구독 상태에서는 자동갱신을 해지할 수 없습니다.',
        );
      return {
        ...toMySubscriptionResponse(canceled.subscription),
        cancellation: {
          pendingRenewalPayment: canceled.pendingRenewalPayment,
          message: canceled.pendingRenewalPayment
            ? '자동갱신이 해지되었습니다. 이미 시작된 결제는 완료될 수 있으며, 결제된 이용 기간은 보장됩니다.'
            : '자동갱신이 해지되었습니다. 이미 결제한 기간까지 이용할 수 있습니다.',
        },
      };
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

    const resumed = await this.subscriptionsRepository.resumeAutoRenewal(
      subscription.id,
    );
    if (!resumed)
      throw new SubscriptionsError(
        'CONFLICT',
        '구독 상태가 변경되어 자동갱신을 재개할 수 없습니다.',
      );
    return resumed;
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
