import { InitialPaymentOutput } from '../dtos/initial-payment-output.dto';
import { initialPaymentOutput } from '../helpers/initial-payment-response.helper';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type {
  InitialPaymentAttempt,
  SubscriptionsRepository,
} from '../../domain/subscriptions.repository';
import { BILLING_PAYMENT_GATEWAY } from '../ports/billing-payment.gateway';
import type {
  BillingPaymentGateway,
  LookupBillingPaymentResult,
} from '../ports/billing-payment.gateway';
import { SUBSCRIPTION_PAYMENT_MAIL_PORT } from '../ports/subscription-payment-mail.port';
import type { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { SubscriptionsError } from '../errors/subscriptions.error';
import { resolveNextPeriod } from '../helpers/subscription-period.helper';
import { toMySubscriptionResponse } from '../helpers/subscription-response.helper';

@Injectable()
export class ReconcileInitialPaymentsUseCase {
  private readonly logger = new Logger(ReconcileInitialPaymentsUseCase.name);
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly repo: SubscriptionsRepository,
    @Inject(BILLING_PAYMENT_GATEWAY)
    private readonly gateway: BillingPaymentGateway,
    @Inject(SUBSCRIPTION_PAYMENT_MAIL_PORT)
    private readonly mailer: SubscriptionPaymentMailPort,
  ) {}

  async execute(
    userId: string,
    idempotencyKey: string,
  ): Promise<InitialPaymentOutput> {
    const subscription =
      await this.repo.getOrCreatePersonalSubscription(userId);
    const attempt = await this.repo.findInitialPayment(
      subscription.id,
      idempotencyKey,
    );
    if (!attempt)
      throw new SubscriptionsError(
        'NOT_FOUND',
        '결제 시도를 찾을 수 없습니다.',
      );
    return this.reconcile(attempt);
  }

  async executeBatch(): Promise<{ processed: number; pending: number }> {
    const attempts = await this.repo.findPendingInitialPayments(new Date(), 50);
    let pending = 0;
    for (const attempt of attempts) {
      const result = await this.reconcile(attempt);
      if (result.status === 'PENDING') pending++;
    }
    return { processed: attempts.length, pending };
  }

  async reconcile(
    attempt: InitialPaymentAttempt,
  ): Promise<InitialPaymentOutput> {
    if (attempt.status !== 'PENDING') return initialPaymentOutput(attempt);
    try {
      await this.repo.deferInitialReconciliation(
        attempt.id,
        new Date(Date.now() + 300_000),
      );
      const payment = await this.gateway.findPaymentByOrderId(
        attempt.externalOrderId,
      );
      return payment
        ? await this.apply(attempt, payment)
        : initialPaymentOutput(attempt);
    } catch {
      return initialPaymentOutput(attempt);
    }
  }

  async apply(
    attempt: InitialPaymentAttempt,
    payment: LookupBillingPaymentResult,
  ): Promise<InitialPaymentOutput> {
    if (
      payment.orderId !== attempt.externalOrderId ||
      payment.totalAmount !== attempt.amount ||
      payment.currency !== attempt.currency ||
      !payment.paymentKey?.trim()
    )
      return initialPaymentOutput(attempt);
    if (
      payment.status === 'DONE' &&
      payment.approvedAt instanceof Date &&
      Number.isFinite(payment.approvedAt.getTime()) &&
      payment.approvedAt.getTime() >= attempt.createdAt.getTime() - 60_000 &&
      payment.approvedAt.getTime() <= Date.now() + 60_000 &&
      attempt.billingKey
    ) {
      const period = resolveNextPeriod(null, payment.approvedAt);
      const updated = await this.repo.completeInitialPayment(attempt, {
        subscriptionId: attempt.subscriptionId,
        provider: 'TOSS_PAYMENTS',
        status: 'DONE',
        externalOrderId: attempt.externalOrderId,
        externalPaymentKey: payment.paymentKey,
        externalBillingKey: attempt.billingKey,
        externalCustomerKey: attempt.customerKey,
        amount: attempt.amount,
        currency: attempt.currency,
        approvedAt: payment.approvedAt,
        ...period,
        rawData: payment.rawData,
      });
      if (updated) {
        try {
          const recipient =
            await this.repo.findBillingMailRecipientBySubscriptionId(
              attempt.subscriptionId,
            );
          if (recipient)
            await this.mailer.sendPaymentSuccess({
              recipientEmail: recipient.email,
              plan: 'PRO',
              amount: attempt.amount,
              currency: attempt.currency,
              approvedAt: payment.approvedAt,
              currentPeriodEnd: period.currentPeriodEnd,
              nextBillingAt: updated.nextBillingAt,
              paymentKind: 'INITIAL',
            });
        } catch {
          this.logger.warn(
            'Initial payment committed; receipt delivery failed.',
          );
        }
        return {
          ...initialPaymentOutput(attempt),
          status: 'DONE',
          subscription: toMySubscriptionResponse(updated),
        };
      }
      const current = await this.repo.findInitialPayment(
        attempt.subscriptionId,
        attempt.idempotencyKey,
      );
      return initialPaymentOutput(current ?? attempt);
    }
    if (['ABORTED', 'EXPIRED', 'CANCELED'].includes(payment.status)) {
      await this.repo.failInitialPayment(attempt, {
        subscriptionId: attempt.subscriptionId,
        provider: 'TOSS_PAYMENTS',
        status: payment.status === 'CANCELED' ? 'CANCELED' : 'FAILED',
        externalOrderId: attempt.externalOrderId,
        externalPaymentKey: payment.paymentKey,
        amount: attempt.amount,
        currency: attempt.currency,
        failedAt: new Date(),
        failureCode: payment.failureCode,
        failureMessage: payment.failureMessage,
        rawData: payment.rawData,
      });
      const current = await this.repo.findInitialPayment(
        attempt.subscriptionId,
        attempt.idempotencyKey,
      );
      return initialPaymentOutput(current ?? attempt);
    }
    return initialPaymentOutput(attempt);
  }
}
