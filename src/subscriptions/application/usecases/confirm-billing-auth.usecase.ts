import { Inject, Injectable } from '@nestjs/common';
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
import { ConfirmBillingAuthInput } from '../dtos/billing-auth-output.dto';
import { MySubscriptionOutput } from '../dtos/my-subscription-output.dto';
import { SubscriptionsError } from '../errors/subscriptions.error';
import { createSubscriptionOrderId } from '../helpers/customer-key.helper';
import { resolveNextPeriod } from '../helpers/subscription-period.helper';
import { toMySubscriptionResponse } from '../helpers/subscription-response.helper';

@Injectable()
export class ConfirmBillingAuthUseCase {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: SubscriptionsRepository,
    @Inject(BILLING_PAYMENT_GATEWAY)
    private readonly billingPaymentGateway: BillingPaymentGateway,
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

    return toMySubscriptionResponse(updated);
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
