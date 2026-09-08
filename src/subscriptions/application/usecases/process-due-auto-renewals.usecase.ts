import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type {
  AutoRenewalPayment,
  SubscriptionsRepository,
} from '../../domain/subscriptions.repository';
import {
  PaymentProvider,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
} from '../../domain/subscription.types';
import { BILLING_PAYMENT_GATEWAY } from '../ports/billing-payment.gateway';
import type {
  BillingPaymentGateway,
  LookupBillingPaymentResult,
} from '../ports/billing-payment.gateway';
import { SUBSCRIPTION_PAYMENT_MAIL_PORT } from '../ports/subscription-payment-mail.port';
import type { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { createAutoRenewalSubscriptionOrderId } from '../helpers/customer-key.helper';
import { resolveNextPeriod } from '../helpers/subscription-period.helper';
import { SubscriptionsError } from '../errors/subscriptions.error';

export type ProcessDueAutoRenewalsOutput = {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  reconciliation: {
    processed: number;
    succeeded: number;
    deferred: number;
    manualReview: number;
    failed: number;
    skipped: number;
  };
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

const RECONCILIATION_DELAY_MS = 5 * 60 * 1000;
const MAX_RECONCILIATION_ATTEMPTS = 12;

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
    const reconciliation = await this.reconcilePayments(now, limit);
    const subscriptions =
      await this.subscriptionsRepository.findDueAutoRenewalSubscriptions(
        now,
        limit,
      );

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (const subscription of subscriptions) {
      try {
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
            renewalDueAt: subscription.nextBillingAt!,
            expectedBillingKey: subscription.externalBillingKey,
            expectedCustomerKey: subscription.externalCustomerKey,
            now,
            renewalPeriodEnd: subscription.currentPeriodEnd,
            reconciliationNextAt: new Date(
              now.getTime() + RECONCILIATION_DELAY_MS,
            ),
          });

        if (!claimed) {
          skipped += 1;
          continue;
        }

        const paymentResult = await this.billingPaymentGateway.chargeBilling({
          timeoutMs: 10_000,
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
        if (
          !this.isVerifiedPayment(paymentResult, {
            externalOrderId: orderId,
            amount,
            currency,
          })
        ) {
          // 실패로 보이는 응답도 확정 조회 전에는 PENDING을 보존한다.
          failed += 1;
          continue;
        }
        const paidAt = paymentResult.approvedAt!;
        const period = resolveNextPeriod(subscription.currentPeriodEnd, paidAt);
        const updated =
          await this.subscriptionsRepository.completeAutoRenewalPayment({
            externalOrderId: orderId,
            externalPaymentKey: paymentResult.paymentKey,
            amount,
            currency,
            approvedAt: paidAt,
            currentPeriodEnd: period.currentPeriodEnd,
            rawData: paymentResult.rawData,
          });
        if (updated) {
          await this.sendPaymentSuccessMail({
            subscriptionId: updated.id,
            amount,
            currency,
            approvedAt: paidAt,
            currentPeriodEnd: updated.currentPeriodEnd!,
            nextBillingAt: updated.nextBillingAt,
          });
          succeeded += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        // 선점 실패도 다음 항목과 격리한다. 선점 후 오류는 남아 있는 주문으로 대사한다.
        this.logger.warn(
          `자동결제 항목 처리에 실패했습니다. subscriptionId=${subscription.id} error=${resolveErrorName(error)}`,
        );
        failed += 1;
      }
    }

    return {
      processed: subscriptions.length,
      succeeded,
      failed,
      skipped,
      reconciliation,
    };
  }

  private async reconcilePayments(
    now: Date,
    limit: number,
  ): Promise<ProcessDueAutoRenewalsOutput['reconciliation']> {
    const result = {
      processed: 0,
      succeeded: 0,
      deferred: 0,
      manualReview: 0,
      failed: 0,
      skipped: 0,
    };
    const candidates =
      await this.subscriptionsRepository.findAutoRenewalPaymentsToReconcile(
        now,
        limit,
      );
    for (const candidate of candidates) {
      result.processed += 1;
      try {
        const nextAttemptAt = new Date(now.getTime() + RECONCILIATION_DELAY_MS);
        const payment =
          await this.subscriptionsRepository.claimAutoRenewalReconciliation(
            candidate.id,
            now,
            nextAttemptAt,
          );
        if (!payment) {
          result.skipped += 1;
          continue;
        }
        let reason = 'PAYMENT_NOT_FOUND';
        let needsReview =
          !payment.renewalDueAt ||
          payment.reconciliationAttempts > MAX_RECONCILIATION_ATTEMPTS;
        if (needsReview) {
          reason = payment.renewalDueAt
            ? 'RECONCILIATION_EXHAUSTED'
            : 'LEGACY_PERIOD_SNAPSHOT_MISSING';
        } else {
          try {
            const response =
              await this.billingPaymentGateway.findPaymentByOrderId(
                payment.externalOrderId,
              );
            if (response && this.isVerifiedPayment(response, payment)) {
              const paidAt = response.approvedAt!;
              const period = resolveNextPeriod(
                payment.renewalPeriodEnd,
                paidAt,
              );
              const updated =
                await this.subscriptionsRepository.completeAutoRenewalPayment({
                  externalOrderId: payment.externalOrderId,
                  externalPaymentKey: response.paymentKey,
                  amount: payment.amount,
                  currency: payment.currency,
                  approvedAt: paidAt,
                  currentPeriodEnd: period.currentPeriodEnd,
                  rawData: response.rawData,
                });
              if (updated) {
                result.succeeded += 1;
                await this.sendPaymentSuccessMail({
                  subscriptionId: updated.id,
                  amount: payment.amount,
                  currency: payment.currency,
                  approvedAt: paidAt,
                  currentPeriodEnd: updated.currentPeriodEnd!,
                  nextBillingAt: updated.nextBillingAt,
                });
              } else {
                result.skipped += 1;
              }
              continue;
            }
            if (response) {
              reason =
                response.status === 'DONE'
                  ? 'PAYMENT_MISMATCH'
                  : 'PAYMENT_NOT_DONE';
              needsReview =
                response.status === 'DONE' ||
                ['CANCELED', 'PARTIAL_CANCELED', 'ABORTED', 'EXPIRED'].includes(
                  response.status,
                );
            }
          } catch (error) {
            reason = 'RECONCILIATION_ERROR';
            this.logger.warn(
              `자동결제 대사를 완료하지 못했습니다. paymentId=${payment.id} error=${resolveErrorName(error)}`,
            );
          }
        }
        needsReview ||=
          payment.reconciliationAttempts >= MAX_RECONCILIATION_ATTEMPTS;
        await this.subscriptionsRepository.deferAutoRenewalReconciliation({
          paymentId: payment.id,
          attempt: payment.reconciliationAttempts,
          nextAttemptAt: needsReview ? null : nextAttemptAt,
          error: reason,
          ...(needsReview ? { manualReviewAt: now } : {}),
        });
        if (needsReview) {
          result.manualReview += 1;
          this.logger.warn(
            `자동결제 운영 확인이 필요합니다. paymentId=${payment.id} reason=${reason}`,
          );
        } else {
          result.deferred += 1;
        }
      } catch (error) {
        result.failed += 1;
        this.logger.warn(
          `자동결제 대사 항목 처리에 실패했습니다. paymentId=${candidate.id} error=${resolveErrorName(error)}`,
        );
      }
    }
    return result;
  }

  private isVerifiedPayment(
    response: LookupBillingPaymentResult,
    payment: Pick<
      AutoRenewalPayment,
      'externalOrderId' | 'amount' | 'currency'
    >,
  ): boolean {
    return (
      response.status === SubscriptionPaymentStatus.DONE &&
      response.orderId === payment.externalOrderId &&
      response.totalAmount === payment.amount &&
      response.currency === payment.currency &&
      typeof response.paymentKey === 'string' &&
      response.paymentKey.length > 0 &&
      response.approvedAt instanceof Date &&
      Number.isFinite(response.approvedAt.getTime())
    );
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
    nextBillingAt: Date | null;
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
