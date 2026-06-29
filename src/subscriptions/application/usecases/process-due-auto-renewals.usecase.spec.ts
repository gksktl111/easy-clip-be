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
  claimAutoRenewalPayment: jest.fn(),
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

const createInput = (now = new Date('2026-02-01T00:00:00.000Z')) => ({
  now,
  accessPolicy: {
    enabled: true,
    expectedSecret: 'auto-renewals-secret',
    providedSecret: 'auto-renewals-secret',
  },
});

describe('ProcessDueAutoRenewalsUseCase', () => {
  it('배치 실행이 비활성화되어 있으면 due 구독 조회 전에 거부한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      createConfig(),
    );

    await expect(
      usecase.execute({
        ...createInput(),
        accessPolicy: {
          ...createInput().accessPolicy,
          enabled: false,
        },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.findDueAutoRenewalSubscriptions).not.toHaveBeenCalled();
    expect(gateway.chargeBilling).not.toHaveBeenCalled();
  });

  it('배치 실행 시크릿이 설정되어 있지 않으면 due 구독 조회 전에 거부한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      createConfig(),
    );

    await expect(
      usecase.execute({
        ...createInput(),
        accessPolicy: {
          ...createInput().accessPolicy,
          expectedSecret: undefined,
        },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.findDueAutoRenewalSubscriptions).not.toHaveBeenCalled();
    expect(gateway.chargeBilling).not.toHaveBeenCalled();
  });

  it('요청 시크릿이 일치하지 않으면 due 구독 조회 전에 거부한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      createConfig(),
    );

    await expect(
      usecase.execute({
        ...createInput(),
        accessPolicy: {
          ...createInput().accessPolicy,
          providedSecret: 'wrong-secret',
        },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(repo.findDueAutoRenewalSubscriptions).not.toHaveBeenCalled();
    expect(gateway.chargeBilling).not.toHaveBeenCalled();
  });

  it('자동결제 성공 시 기존 기간 뒤로 1개월 연장한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const now = new Date('2026-02-01T00:00:00.000Z');

    repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
      createSubscription(),
    ]);
    repo.claimAutoRenewalPayment.mockResolvedValue(true);
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'provider-order-id',
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
    const result = await usecase.execute(createInput(now));

    expect(repo.claimAutoRenewalPayment).toHaveBeenCalledWith({
      subscriptionId: 'subscription-id',
      provider: PaymentProvider.TOSS_PAYMENTS,
      externalOrderId: 'sub_subscription-id_20260201000000',
      amount: 4900,
      currency: 'KRW',
    });
    expect(gateway.chargeBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'sub_subscription-id_20260201000000',
      }),
    );
    expect(repo.activateByPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        externalOrderId: 'sub_subscription-id_20260201000000',
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
    repo.claimAutoRenewalPayment.mockResolvedValue(true);
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'provider-order-id',
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
    const result = await usecase.execute(createInput(now));

    expect(repo.recordPaymentFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        externalOrderId: 'sub_subscription-id_20260201000000',
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

  it('동일 청구주기 결제가 이미 claim되어 있으면 외부 과금을 건너뛴다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const now = new Date('2026-02-01T00:00:00.000Z');

    repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
      createSubscription(),
    ]);
    repo.claimAutoRenewalPayment.mockResolvedValue(false);

    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      createConfig(),
    );
    const result = await usecase.execute(createInput(now));

    expect(repo.claimAutoRenewalPayment).toHaveBeenCalledWith({
      subscriptionId: 'subscription-id',
      provider: PaymentProvider.TOSS_PAYMENTS,
      externalOrderId: 'sub_subscription-id_20260201000000',
      amount: 4900,
      currency: 'KRW',
    });
    expect(gateway.chargeBilling).not.toHaveBeenCalled();
    expect(repo.activateByPayment).not.toHaveBeenCalled();
    expect(repo.recordPaymentFailure).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 1,
      succeeded: 0,
      failed: 0,
    });
  });
});
