/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { ProcessDueAutoRenewalsUseCase } from './process-due-auto-renewals.usecase';
import { BillingPaymentGateway } from '../ports/billing-payment.gateway';
import { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  PaymentProvider,
  Subscription,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';

const createRepository = (): jest.Mocked<SubscriptionsRepository> => ({
  getOrCreatePersonalSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  activateByPayment: jest.fn(),
  recordPaymentFailure: jest.fn(),
  findDueAutoRenewalSubscriptions: jest.fn(),
});

const createGateway = (): jest.Mocked<BillingPaymentGateway> => ({
  issueBillingKey: jest.fn(),
  chargeBilling: jest.fn(),
});

const createConfig = () =>
  ({
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        PRO_MONTHLY_AMOUNT: '4900',
        TOSS_PAYMENTS_CURRENCY: 'KRW',
        TOSS_PAYMENTS_PRO_ORDER_NAME: 'Easy Clip PRO 월간 구독',
      };
      return values[key] ?? defaultValue;
    }),
  }) as unknown as ConfigService;

const createSubscription = (
  overrides: Partial<Subscription> = {},
): Subscription => ({
  id: 'subscription-id',
  workspaceId: 'workspace-id',
  plan: SubscriptionPlan.PRO,
  status: SubscriptionStatus.ACTIVE,
  autoRenew: true,
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
  nextBillingAt: new Date('2026-02-01T00:00:00.000Z'),
  provider: PaymentProvider.TOSS_PAYMENTS,
  externalBillingKey: 'billing-key',
  externalCustomerKey: 'customer-key',
  ...overrides,
});

describe('ProcessDueAutoRenewalsUseCase', () => {
  it('자동결제 성공 시 기존 기간 뒤로 1개월 연장한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const now = new Date('2026-02-01T00:00:00.000Z');

    repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
      createSubscription(),
    ]);
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'order-id',
      status: SubscriptionPaymentStatus.DONE,
      totalAmount: 4900,
      currency: 'KRW',
      approvedAt: now,
      failureCode: null,
      failureMessage: null,
      rawData: {},
    });

    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      createConfig(),
    );
    const result = await usecase.execute(now);

    expect(repo.activateByPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z'),
        nextBillingAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    );
    expect(result).toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
    });
  });

  it('자동결제 실패 시 구독 기간을 변경하지 않고 실패 이력을 저장한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const now = new Date('2026-02-01T00:00:00.000Z');

    repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
      createSubscription(),
    ]);
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'order-id',
      status: SubscriptionPaymentStatus.FAILED,
      totalAmount: 4900,
      currency: 'KRW',
      approvedAt: null,
      failureCode: 'PAY_PROCESS_ABORTED',
      failureMessage: '결제 실패',
      rawData: {},
    });

    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      createConfig(),
    );
    const result = await usecase.execute(now);

    expect(repo.recordPaymentFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubscriptionPaymentStatus.FAILED,
        failureCode: 'PAY_PROCESS_ABORTED',
      }),
    );
    expect(repo.activateByPayment).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 1,
      succeeded: 0,
      failed: 1,
    });
  });
});
