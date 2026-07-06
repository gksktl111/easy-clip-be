import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  PaymentProvider,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
} from '../../domain/subscription.types';
import { BILLING_PAYMENT_GATEWAY } from '../ports/billing-payment.gateway';
import type { BillingPaymentGateway } from '../ports/billing-payment.gateway';
import { SUBSCRIPTION_PAYMENT_MAIL_PORT } from '../ports/subscription-payment-mail.port';
import type { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { createAutoRenewalSubscriptionOrderId } from '../helpers/customer-key.helper';
import { resolveNextPeriod } from '../helpers/subscription-period.helper';
import { SubscriptionsError } from '../errors/subscriptions.error';

export type ProcessDueAutoRenewalsOutput = {
  processed: number;
  succeeded: number;
  failed: number;
};

export type ProcessDueAutoRenewalsInput = {
  now?: Date;
  limit?: number;
  accessPolicy: ProcessDueAutoRenewalsAccessPolicyInput;
};

export type ProcessDueAutoRenewalsAccessPolicyInput = {
  enabled: boolean;
  expectedSecret?: string;
  providedSecret?: string;
};

@Injectable()
export class ProcessDueAutoRenewalsUseCase {
  private readonly logger = new Logger(ProcessDueAutoRenewalsUseCase.name);

  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: SubscriptionsRepository,
    @Inject(BILLING_PAYMENT_GATEWAY)
    private readonly billingPaymentGateway: BillingPaymentGateway,
    @Inject(SUBSCRIPTION_PAYMENT_MAIL_PORT)
    private readonly subscriptionPaymentMailPort: SubscriptionPaymentMailPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    input: ProcessDueAutoRenewalsInput,
  ): Promise<ProcessDueAutoRenewalsOutput> {
    this.assertAutoRenewalsBatchAllowed(input.accessPolicy);

    const now = input.now ?? new Date();
    const limit = input.limit ?? 50;
    const subscriptions =
      await this.subscriptionsRepository.findDueAutoRenewalSubscriptions(
        now,
        limit,
      );

    let succeeded = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      if (
        !subscription.externalBillingKey ||
        !subscription.externalCustomerKey
      ) {
        failed += 1;
        continue;
      }

      const amount = this.getProPlanAmount();
      const currency = this.configService.get<string>(
        'TOSS_PAYMENTS_CURRENCY',
        'KRW',
      );
      const orderId = createAutoRenewalSubscriptionOrderId(
        subscription.id,
        subscription.nextBillingAt ?? now,
      );

      const claimed =
        await this.subscriptionsRepository.claimAutoRenewalPayment({
          subscriptionId: subscription.id,
          provider: PaymentProvider.TOSS_PAYMENTS,
          externalOrderId: orderId,
          amount,
          currency,
        });

      if (!claimed) {
        continue;
      }

      const paymentResult = await this.billingPaymentGateway.chargeBilling({
        billingKey: subscription.externalBillingKey,
        customerKey: subscription.externalCustomerKey,
        orderId,
        orderName: this.configService.get<string>(
          'TOSS_PAYMENTS_PRO_ORDER_NAME',
          'Easy Clip PRO 월간 구독',
        ),
        amount,
        currency,
      });

      if (paymentResult.status === SubscriptionPaymentStatus.DONE) {
        const paidAt = paymentResult.approvedAt ?? now;
        const period = resolveNextPeriod(subscription.currentPeriodEnd, paidAt);

        const updated = await this.subscriptionsRepository.activateByPayment({
          subscriptionId: subscription.id,
          provider: PaymentProvider.TOSS_PAYMENTS,
          status: SubscriptionPaymentStatus.DONE,
          externalBillingKey: subscription.externalBillingKey,
          externalCustomerKey: subscription.externalCustomerKey,
          externalPaymentKey: paymentResult.paymentKey,
          externalOrderId: orderId,
          amount: paymentResult.totalAmount,
          currency: paymentResult.currency,
          approvedAt: paidAt,
          startedAt: subscription.startedAt,
          currentPeriodEnd: period.currentPeriodEnd,
          nextBillingAt: period.nextBillingAt,
          rawData: paymentResult.rawData,
        });
        await this.sendPaymentSuccessMail({
          subscriptionId: updated.id,
          amount: paymentResult.totalAmount,
          currency: paymentResult.currency,
          approvedAt: paidAt,
          currentPeriodEnd: period.currentPeriodEnd,
          nextBillingAt: period.nextBillingAt,
        });
        succeeded += 1;
        continue;
      }

      await this.subscriptionsRepository.recordPaymentFailure({
        subscriptionId: subscription.id,
        provider: PaymentProvider.TOSS_PAYMENTS,
        status: SubscriptionPaymentStatus.FAILED,
        externalPaymentKey: paymentResult.paymentKey,
        externalOrderId: orderId,
        amount,
        currency,
        failedAt: now,
        failureCode: paymentResult.failureCode,
        failureMessage: paymentResult.failureMessage,
        rawData: paymentResult.rawData,
      });
      failed += 1;
    }

    return {
      processed: subscriptions.length,
      succeeded,
      failed,
    };
  }

  private getProPlanAmount(): number {
    const raw = this.configService.get<string>('PRO_MONTHLY_AMOUNT');
    const amount = raw ? Number(raw) : 4900;
    return Number.isInteger(amount) && amount > 0 ? amount : 4900;
  }

  private async sendPaymentSuccessMail(input: {
    subscriptionId: string;
    amount: number;
    currency: string;
    approvedAt: Date;
    currentPeriodEnd: Date;
    nextBillingAt: Date;
  }): Promise<void> {
    try {
      const recipient =
        await this.subscriptionsRepository.findBillingMailRecipientBySubscriptionId(
          input.subscriptionId,
        );

      if (!recipient) {
        this.logger.warn(
          `자동결제 성공 메일 수신자를 찾지 못했습니다. subscriptionId=${input.subscriptionId}`,
        );
        return;
      }

      // 자동결제 배치의 성공/실패 집계는 결제 결과 기준이며, 메일 발송 실패로 성공 건을 실패 처리하지 않는다.
      await this.subscriptionPaymentMailPort.sendPaymentSuccess({
        recipientEmail: recipient.email,
        amount: input.amount,
        currency: input.currency,
        approvedAt: input.approvedAt,
        plan: SubscriptionPlan.PRO,
        currentPeriodEnd: input.currentPeriodEnd,
        nextBillingAt: input.nextBillingAt,
        paymentKind: 'AUTO_RENEWAL',
      });
    } catch (error) {
      this.logger.warn(
        `자동결제 성공 메일 발송에 실패했습니다. subscriptionId=${input.subscriptionId} error=${resolveErrorName(error)}`,
      );
    }
  }

  private assertAutoRenewalsBatchAllowed(
    accessPolicy: ProcessDueAutoRenewalsAccessPolicyInput,
  ): void {
    const expectedSecret = accessPolicy.expectedSecret?.trim();
    const providedSecret = accessPolicy.providedSecret?.trim();

    if (!accessPolicy.enabled) {
      throw new SubscriptionsError(
        'FORBIDDEN',
        '자동결제 배치 실행이 비활성화되어 있습니다.',
      );
    }

    if (!expectedSecret) {
      throw new SubscriptionsError(
        'FORBIDDEN',
        '자동결제 배치 실행 시크릿이 설정되어 있지 않습니다.',
      );
    }

    if (!providedSecret || !isSameSecret(providedSecret, expectedSecret)) {
      throw new SubscriptionsError(
        'UNAUTHORIZED',
        '자동결제 배치 실행 시크릿이 올바르지 않습니다.',
      );
    }
  }
}

function isSameSecret(providedSecret: string, expectedSecret: string): boolean {
  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(expectedSecret);

  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

function resolveErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
