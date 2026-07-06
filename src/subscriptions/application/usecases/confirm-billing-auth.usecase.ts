import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  PaymentProvider,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';
import { BILLING_PAYMENT_GATEWAY } from '../ports/billing-payment.gateway';
import type { BillingPaymentGateway } from '../ports/billing-payment.gateway';
import { SUBSCRIPTION_PAYMENT_MAIL_PORT } from '../ports/subscription-payment-mail.port';
import type { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { ConfirmBillingAuthInput } from '../dtos/billing-auth-output.dto';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';
import { SubscriptionsError } from '../errors/subscriptions.error';
import { createSubscriptionOrderId } from '../helpers/customer-key.helper';
import { resolveNextPeriod } from '../helpers/subscription-period.helper';
import { toMySubscriptionResponse } from '../helpers/subscription-response.helper';

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
  ) {}

  async execute(
    userId: string,
    input: ConfirmBillingAuthInput,
  ): Promise<MySubscriptionOutput> {
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

    if (this.canResumeWithoutImmediatePayment(subscription)) {
      const updated = await this.subscriptionsRepository.updateSubscription(
        subscription.id,
        {
          status: SubscriptionStatus.ACTIVE,
          autoRenew: true,
          nextBillingAt: subscription.currentPeriodEnd,
        },
      );

      await this.sendSubscriptionResumedMail({
        userId,
        currentPeriodEnd: updated.currentPeriodEnd,
        nextBillingAt: updated.nextBillingAt,
      });

      return toMySubscriptionResponse(updated);
    }

    const amount = this.getProPlanAmount();
    const currency = this.configService.get<string>(
      'TOSS_PAYMENTS_CURRENCY',
      'KRW',
    );
    const orderId = createSubscriptionOrderId(subscription.id);
    const orderName = this.configService.get<string>(
      'TOSS_PAYMENTS_PRO_ORDER_NAME',
      'Easy Clip PRO 월간 구독',
    );

    const billingKeyResult =
      await this.billingPaymentGateway.issueBillingKey(input);
    const paymentResult = await this.billingPaymentGateway.chargeBilling({
      billingKey: billingKeyResult.billingKey,
      customerKey: input.customerKey,
      orderId,
      orderName,
      amount,
      currency,
    });

    if (paymentResult.status !== SubscriptionPaymentStatus.DONE) {
      await this.subscriptionsRepository.recordPaymentFailure({
        subscriptionId: subscription.id,
        provider: PaymentProvider.TOSS_PAYMENTS,
        status: SubscriptionPaymentStatus.FAILED,
        externalPaymentKey: paymentResult.paymentKey,
        externalOrderId: paymentResult.orderId,
        amount,
        currency,
        failedAt: new Date(),
        failureCode: paymentResult.failureCode,
        failureMessage: paymentResult.failureMessage,
        rawData: paymentResult.rawData,
      });

      throw new SubscriptionsError(
        'CONFLICT',
        '최초 구독 결제에 실패했습니다.',
      );
    }

    const paidAt = paymentResult.approvedAt ?? new Date();
    const period = resolveNextPeriod(subscription.currentPeriodEnd, paidAt);

    const updated = await this.subscriptionsRepository.activateByPayment({
      subscriptionId: subscription.id,
      provider: PaymentProvider.TOSS_PAYMENTS,
      status: SubscriptionPaymentStatus.DONE,
      externalBillingKey: billingKeyResult.billingKey,
      externalCustomerKey: input.customerKey,
      externalPaymentKey: paymentResult.paymentKey,
      externalOrderId: paymentResult.orderId,
      amount: paymentResult.totalAmount,
      currency: paymentResult.currency,
      approvedAt: paidAt,
      startedAt:
        subscription.plan === SubscriptionPlan.PRO &&
        subscription.status === SubscriptionStatus.ACTIVE
          ? subscription.startedAt
          : period.startedAt,
      currentPeriodEnd: period.currentPeriodEnd,
      nextBillingAt: period.nextBillingAt,
      rawData: paymentResult.rawData,
    });

    await this.sendPaymentSuccessMail({
      userId,
      amount: paymentResult.totalAmount,
      currency: paymentResult.currency,
      approvedAt: paidAt,
      currentPeriodEnd: period.currentPeriodEnd,
      nextBillingAt: period.nextBillingAt,
    });

    return toMySubscriptionResponse(updated);
  }

  private async sendPaymentSuccessMail(input: {
    userId: string;
    amount: number;
    currency: string;
    approvedAt: Date;
    currentPeriodEnd: Date;
    nextBillingAt: Date;
  }): Promise<void> {
    try {
      const recipient =
        await this.subscriptionsRepository.findBillingMailRecipientByUserId(
          input.userId,
        );

      if (!recipient) {
        this.logger.warn(
          `결제 성공 메일 수신자를 찾지 못했습니다. userId=${input.userId}`,
        );
        return;
      }

      // 결제 DB 반영은 이미 완료된 상태이므로, 메일 실패는 결제 성공 응답을 롤백하지 않는다.
      await this.subscriptionPaymentMailPort.sendPaymentSuccess({
        recipientEmail: recipient.email,
        amount: input.amount,
        currency: input.currency,
        approvedAt: input.approvedAt,
        plan: SubscriptionPlan.PRO,
        currentPeriodEnd: input.currentPeriodEnd,
        nextBillingAt: input.nextBillingAt,
        paymentKind: 'INITIAL',
      });
    } catch (error) {
      this.logger.warn(
        `결제 성공 메일 발송에 실패했습니다. userId=${input.userId} error=${resolveErrorName(error)}`,
      );
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

  private getProPlanAmount(): number {
    const raw = this.configService.get<string>('PRO_MONTHLY_AMOUNT');
    const amount = raw ? Number(raw) : 4900;

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new SubscriptionsError(
        'INTERNAL',
        'PRO 월간 구독 금액 설정이 올바르지 않습니다.',
      );
    }

    return amount;
  }
}

function resolveErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
