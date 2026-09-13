import { InitialPaymentOutput } from '../dtos/initial-payment-output.dto';
import { initialPaymentOutput } from '../helpers/initial-payment-response.helper';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';
import { BILLING_PAYMENT_GATEWAY } from '../ports/billing-payment.gateway';
import type { BillingPaymentGateway } from '../ports/billing-payment.gateway';
import { SUBSCRIPTION_PAYMENT_MAIL_PORT } from '../ports/subscription-payment-mail.port';
import type { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { ConfirmBillingAuthInput } from '../dtos/billing-auth-output.dto';
import { SubscriptionsError } from '../errors/subscriptions.error';
import { createSubscriptionOrderId } from '../helpers/customer-key.helper';
import { toMySubscriptionResponse } from '../helpers/subscription-response.helper';

import { resolveProMonthlyPrice } from '../helpers/pro-monthly-price.helper';
import { ReconcileInitialPaymentsUseCase } from './reconcile-initial-payments.usecase';

@Injectable()
export class ConfirmBillingAuthUseCase {
  private readonly logger = new Logger(ConfirmBillingAuthUseCase.name);

  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: SubscriptionsRepository,
    @Inject(BILLING_PAYMENT_GATEWAY)
    private readonly billingPaymentGateway: BillingPaymentGateway,
    @Inject(SUBSCRIPTION_PAYMENT_MAIL_PORT)
    private readonly subscriptionPaymentMailPort: SubscriptionPaymentMailPort,
    private readonly configService: ConfigService,
    private readonly reconciler: ReconcileInitialPaymentsUseCase,
  ) {}

  async execute(
    userId: string,
    input: ConfirmBillingAuthInput,
  ): Promise<InitialPaymentOutput> {
    const subscription =
      await this.subscriptionsRepository.getOrCreatePersonalSubscription(
        userId,
      );

    if (subscription.externalCustomerKey !== input.customerKey) {
      throw new SubscriptionsError(
        'BAD_REQUEST',
        '구독 인증 customerKey가 일치하지 않습니다.',
      );
    }

    const existing = await this.subscriptionsRepository.findInitialPayment(
      subscription.id,
      input.idempotencyKey,
    );
    if (existing) return this.reconciler.reconcile(existing);

    if (this.canResumeWithoutImmediatePayment(subscription)) {
      const updated = await this.subscriptionsRepository.resumeAutoRenewal(
        subscription.id,
      );
      if (!updated)
        throw new SubscriptionsError(
          'CONFLICT',
          '구독 상태가 변경되어 자동갱신을 재개할 수 없습니다.',
        );

      await this.sendSubscriptionResumedMail({
        userId,
        currentPeriodEnd: updated.currentPeriodEnd,
        nextBillingAt: updated.nextBillingAt,
      });

      return {
        attemptId: null,
        status: 'DONE',
        subscription: toMySubscriptionResponse(updated),
      };
    }

    const price = resolveProMonthlyPrice(this.configService);
    if (input.priceVersion !== price.priceVersion)
      throw new SubscriptionsError(
        'CONFLICT',
        '구독 가격이 변경되었습니다. 최신 가격을 확인해주세요.',
      );
    const claim = await this.subscriptionsRepository.claimInitialPayment({
      subscriptionId: subscription.id,
      idempotencyKey: input.idempotencyKey,
      externalOrderId: createSubscriptionOrderId(subscription.id),
      amount: price.amount,
      currency: price.currency,
      priceVersion: price.priceVersion,
      customerKey: input.customerKey,
    });
    if (!claim)
      throw new SubscriptionsError(
        'CONFLICT',
        '이미 구독 중이거나 이전 결제 결과를 확인 중입니다.',
      );
    if (!claim.claimed) return this.reconciler.reconcile(claim.attempt);
    const attempt = claim.attempt;
    try {
      const billing = await this.billingPaymentGateway.issueBillingKey({
        ...input,
        idempotencyKey: `${attempt.id}:issue`,
      });
      if (!billing.billingKey) return initialPaymentOutput(attempt);
      await this.subscriptionsRepository.saveInitialBillingKey(
        attempt.id,
        billing.billingKey,
      );
      attempt.billingKey = billing.billingKey;
      const payment = await this.billingPaymentGateway.chargeBilling({
        idempotencyKey: `${attempt.id}:charge`,
        billingKey: billing.billingKey,
        customerKey: attempt.customerKey,
        orderId: attempt.externalOrderId,
        amount: attempt.amount,
        currency: attempt.currency,
        orderName: this.configService.get<string>(
          'TOSS_PAYMENTS_PRO_ORDER_NAME',
          'Easy Clip PRO 월간 구독',
        ),
        timeoutMs: 10_000,
      });
      return await this.reconciler.apply(attempt, payment);
    } catch {
      // Transport and DB failures leave the durable order unresolved. Never charge again.
      return initialPaymentOutput(attempt);
    }
  }

  private async sendSubscriptionResumedMail(input: {
    userId: string;
    currentPeriodEnd: Date | null;
    nextBillingAt: Date | null;
  }): Promise<void> {
    if (!input.currentPeriodEnd || !input.nextBillingAt) {
      return;
    }

    try {
      const recipient =
        await this.subscriptionsRepository.findBillingMailRecipientByUserId(
          input.userId,
        );

      if (!recipient) {
        this.logger.warn(
          `구독 재개 메일 수신자를 찾지 못했습니다. userId=${input.userId}`,
        );
        return;
      }

      // 재개는 즉시 과금이 아니므로 결제 성공 메일과 분리해 다음 결제 예정일만 안내한다.
      await this.subscriptionPaymentMailPort.sendSubscriptionResumed({
        recipientEmail: recipient.email,
        plan: SubscriptionPlan.PRO,
        currentPeriodEnd: input.currentPeriodEnd,
        nextBillingAt: input.nextBillingAt,
      });
    } catch (error) {
      this.logger.warn(
        `구독 재개 메일 발송에 실패했습니다. userId=${input.userId} error=${resolveErrorName(error)}`,
      );
    }
  }

  private canResumeWithoutImmediatePayment(subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
    externalBillingKey: string | null;
    externalCustomerKey: string | null;
  }): boolean {
    return (
      subscription.plan === SubscriptionPlan.PRO &&
      subscription.status === SubscriptionStatus.CANCELED &&
      subscription.currentPeriodEnd !== null &&
      subscription.currentPeriodEnd > new Date() &&
      subscription.externalBillingKey !== null &&
      subscription.externalCustomerKey !== null
    );
  }
}

function resolveErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
