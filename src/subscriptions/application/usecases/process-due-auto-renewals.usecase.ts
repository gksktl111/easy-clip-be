import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  PaymentProvider,
  SubscriptionPaymentStatus,
} from '../../domain/subscription.types';
import { BILLING_PAYMENT_GATEWAY } from '../ports/billing-payment.gateway';
import type { BillingPaymentGateway } from '../ports/billing-payment.gateway';
import { createSubscriptionOrderId } from '../helpers/customer-key.helper';
import { resolveNextPeriod } from '../helpers/subscription-period.helper';

export type ProcessDueAutoRenewalsOutput = {
  processed: number;
  succeeded: number;
  failed: number;
};

@Injectable()
export class ProcessDueAutoRenewalsUseCase {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: SubscriptionsRepository,
    @Inject(BILLING_PAYMENT_GATEWAY)
    private readonly billingPaymentGateway: BillingPaymentGateway,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    now = new Date(),
    limit = 50,
  ): Promise<ProcessDueAutoRenewalsOutput> {
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
      const orderId = createSubscriptionOrderId(subscription.id);

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

        await this.subscriptionsRepository.activateByPayment({
          subscriptionId: subscription.id,
          provider: PaymentProvider.TOSS_PAYMENTS,
          status: SubscriptionPaymentStatus.DONE,
          externalBillingKey: subscription.externalBillingKey,
          externalCustomerKey: subscription.externalCustomerKey,
          externalPaymentKey: paymentResult.paymentKey,
          externalOrderId: paymentResult.orderId,
          amount: paymentResult.totalAmount,
          currency: paymentResult.currency,
          approvedAt: paidAt,
          startedAt: subscription.startedAt,
          currentPeriodEnd: period.currentPeriodEnd,
          nextBillingAt: period.nextBillingAt,
          rawData: paymentResult.rawData,
        });
        succeeded += 1;
        continue;
      }

      await this.subscriptionsRepository.recordPaymentFailure({
        subscriptionId: subscription.id,
        provider: PaymentProvider.TOSS_PAYMENTS,
        status: SubscriptionPaymentStatus.FAILED,
        externalPaymentKey: paymentResult.paymentKey,
        externalOrderId: paymentResult.orderId,
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
}
