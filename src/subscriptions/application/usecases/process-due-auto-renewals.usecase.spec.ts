/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { ProcessDueAutoRenewalsUseCase } from './process-due-auto-renewals.usecase';
import { BillingPaymentGateway } from '../ports/billing-payment.gateway';
import { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { createSubscriptionsRepositoryMock as createRepository } from '../../test-support/create-subscriptions-repository-mock';
import {
  PaymentProvider,
  Subscription,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';

const createGateway = (): jest.Mocked<BillingPaymentGateway> => ({
  issueBillingKey: jest.fn(),
  chargeBilling: jest.fn(),
  findPaymentByOrderId: jest.fn(),
});

const createMailer = (): jest.Mocked<SubscriptionPaymentMailPort> => ({
  sendPaymentSuccess: jest.fn(),
  sendSubscriptionResumed: jest.fn(),
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
    const mailer = createMailer();
    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      mailer,
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
    const mailer = createMailer();
    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      mailer,
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
    const mailer = createMailer();
    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      mailer,
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
    const mailer = createMailer();
    const now = new Date('2026-02-01T00:00:00.000Z');

    repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
      createSubscription(),
    ]);
    repo.claimAutoRenewalPayment.mockResolvedValue(true);
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'sub_subscription-id_20260201000000',
      status: SubscriptionPaymentStatus.DONE,
      totalAmount: 4900,
      currency: 'KRW',
      approvedAt: now,
      failureCode: null,
      failureMessage: null,
      rawData: {},
    });
    repo.completeAutoRenewalPayment.mockResolvedValue(
      createSubscription({
        currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z'),
        nextBillingAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    );
    repo.findBillingMailRecipientBySubscriptionId.mockResolvedValue({
      email: 'user@example.com',
    });

    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );
    const result = await usecase.execute(createInput(now));

    expect(repo.claimAutoRenewalPayment).toHaveBeenCalledWith({
      subscriptionId: 'subscription-id',
      provider: PaymentProvider.TOSS_PAYMENTS,
      externalOrderId: 'sub_subscription-id_20260201000000',
      amount: 4900,
      currency: 'KRW',
      renewalDueAt: now,
      expectedBillingKey: 'billing-key',
      expectedCustomerKey: 'customer-key',
      now,
      renewalPeriodEnd: now,
      reconciliationNextAt: new Date(now.getTime() + 5 * 60 * 1000),
    });
    expect(gateway.chargeBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'sub_subscription-id_20260201000000',
      }),
    );
    expect(repo.completeAutoRenewalPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        externalOrderId: 'sub_subscription-id_20260201000000',
        currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z'),
      }),
    );
    expect(result).toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
      reconciliation: {
        processed: 0,
        succeeded: 0,
        deferred: 0,
        manualReview: 0,
        failed: 0,
        skipped: 0,
      },
    });
    expect(mailer.sendPaymentSuccess).toHaveBeenCalledWith({
      recipientEmail: 'user@example.com',
      amount: 4900,
      currency: 'KRW',
      approvedAt: now,
      plan: SubscriptionPlan.PRO,
      currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z'),
      nextBillingAt: new Date('2026-03-01T00:00:00.000Z'),
      paymentKind: 'AUTO_RENEWAL',
    });
  });

  it('자동결제 실패 응답도 확정 조회 전에는 미확정 주문을 보존한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();
    const now = new Date('2026-02-01T00:00:00.000Z');

    repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
      createSubscription(),
    ]);
    repo.claimAutoRenewalPayment.mockResolvedValue(true);
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'sub_subscription-id_20260201000000',
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
      mailer,
      createConfig(),
    );
    const result = await usecase.execute(createInput(now));

    expect(repo.recordPaymentFailure).not.toHaveBeenCalled();
    expect(repo.completeAutoRenewalPayment).not.toHaveBeenCalled();
    expect(mailer.sendPaymentSuccess).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 1,
      succeeded: 0,
      failed: 1,
      skipped: 0,
      reconciliation: {
        processed: 0,
        succeeded: 0,
        deferred: 0,
        manualReview: 0,
        failed: 0,
        skipped: 0,
      },
    });
  });

  it('동일 청구주기 결제가 이미 claim되어 있으면 외부 과금을 건너뛴다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();
    const now = new Date('2026-02-01T00:00:00.000Z');

    repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
      createSubscription(),
    ]);
    repo.claimAutoRenewalPayment.mockResolvedValue(false);

    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );
    const result = await usecase.execute(createInput(now));

    expect(repo.claimAutoRenewalPayment).toHaveBeenCalledWith({
      subscriptionId: 'subscription-id',
      provider: PaymentProvider.TOSS_PAYMENTS,
      externalOrderId: 'sub_subscription-id_20260201000000',
      amount: 4900,
      currency: 'KRW',
      renewalDueAt: now,
      expectedBillingKey: 'billing-key',
      expectedCustomerKey: 'customer-key',
      now,
      renewalPeriodEnd: now,
      reconciliationNextAt: new Date(now.getTime() + 5 * 60 * 1000),
    });
    expect(gateway.chargeBilling).not.toHaveBeenCalled();
    expect(repo.completeAutoRenewalPayment).not.toHaveBeenCalled();
    expect(repo.recordPaymentFailure).not.toHaveBeenCalled();
    expect(mailer.sendPaymentSuccess).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 1,
      succeeded: 0,
      failed: 0,
      skipped: 1,
      reconciliation: {
        processed: 0,
        succeeded: 0,
        deferred: 0,
        manualReview: 0,
        failed: 0,
        skipped: 0,
      },
    });
  });

  it('자동결제 성공 메일 발송 실패가 배치 성공 집계를 바꾸지 않는다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();
    const now = new Date('2026-02-01T00:00:00.000Z');

    repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
      createSubscription(),
    ]);
    repo.claimAutoRenewalPayment.mockResolvedValue(true);
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'sub_subscription-id_20260201000000',
      status: SubscriptionPaymentStatus.DONE,
      totalAmount: 4900,
      currency: 'KRW',
      approvedAt: now,
      failureCode: null,
      failureMessage: null,
      rawData: {},
    });
    repo.completeAutoRenewalPayment.mockResolvedValue(
      createSubscription({
        currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z'),
        nextBillingAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    );
    repo.findBillingMailRecipientBySubscriptionId.mockResolvedValue({
      email: 'user@example.com',
    });
    mailer.sendPaymentSuccess.mockRejectedValue(new Error('resend failed'));

    const usecase = new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );
    const result = await usecase.execute(createInput(now));

    expect(result).toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
      reconciliation: {
        processed: 0,
        succeeded: 0,
        deferred: 0,
        manualReview: 0,
        failed: 0,
        skipped: 0,
      },
    });
  });

  it.each(['claim', 'gateway'])(
    '%s 오류 이후 다음 구독의 결제를 계속한다',
    async (stage) => {
      const repo = createRepository();
      const gateway = createGateway();
      const now = createInput().now;
      repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
        createSubscription({ id: 'first' }),
        createSubscription({ id: 'second' }),
      ]);
      repo.claimAutoRenewalPayment.mockResolvedValue(true);
      gateway.chargeBilling.mockImplementation((params) =>
        Promise.resolve({
          paymentKey: 'paid-key',
          orderId: params.orderId,
          status: 'DONE',
          totalAmount: 4900,
          currency: 'KRW',
          approvedAt: now,
          failureCode: null,
          failureMessage: null,
          rawData: {},
        }),
      );
      if (stage === 'claim')
        repo.claimAutoRenewalPayment.mockRejectedValueOnce(
          new Error('claim failed'),
        );
      else
        gateway.chargeBilling.mockRejectedValueOnce(
          new Error('transport failed'),
        );
      repo.completeAutoRenewalPayment.mockResolvedValue(
        createSubscription({ id: 'second' }),
      );
      const result = await new ProcessDueAutoRenewalsUseCase(
        repo,
        gateway,
        createMailer(),
        createConfig(),
      ).execute(createInput());
      expect(result).toMatchObject({
        processed: 2,
        succeeded: 1,
        failed: 1,
        skipped: 0,
      });
      expect(gateway.chargeBilling).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderId: 'sub_second_20260201000000' }),
      );
      expect(repo.completeAutoRenewalPayment).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['claim', 'defer'])(
    '대사 %s 오류가 다음 대사와 신규 결제를 중단하지 않는다',
    async (stage) => {
      const repo = createRepository();
      const gateway = createGateway();
      const candidate = (id: string) => ({
        id,
        subscriptionId: id,
        externalOrderId: `order-${id}`,
        amount: 4900,
        currency: 'KRW',
        renewalDueAt: createInput().now,
        renewalPeriodEnd: createInput().now,
        reconciliationAttempts: 1,
      });
      repo.findAutoRenewalPaymentsToReconcile.mockResolvedValue([
        candidate('first'),
        candidate('second'),
      ]);
      repo.claimAutoRenewalReconciliation.mockImplementation((id) =>
        Promise.resolve(candidate(id)),
      );
      gateway.findPaymentByOrderId.mockResolvedValue(null);
      if (stage === 'claim')
        repo.claimAutoRenewalReconciliation.mockRejectedValueOnce(
          new Error('claim failed'),
        );
      else
        repo.deferAutoRenewalReconciliation.mockRejectedValueOnce(
          new Error('defer failed'),
        );
      repo.findDueAutoRenewalSubscriptions.mockResolvedValue([
        createSubscription(),
      ]);
      repo.claimAutoRenewalPayment.mockResolvedValue(true);
      gateway.chargeBilling.mockResolvedValue({
        paymentKey: 'paid-key',
        orderId: 'sub_subscription-id_20260201000000',
        status: 'DONE',
        totalAmount: 4900,
        currency: 'KRW',
        approvedAt: createInput().now,
        failureCode: null,
        failureMessage: null,
        rawData: {},
      });
      repo.completeAutoRenewalPayment.mockResolvedValue(createSubscription());
      const result = await new ProcessDueAutoRenewalsUseCase(
        repo,
        gateway,
        createMailer(),
        createConfig(),
      ).execute(createInput());
      expect(result).toMatchObject({
        processed: 1,
        succeeded: 1,
        failed: 0,
        skipped: 0,
        reconciliation: {
          processed: 2,
          succeeded: 0,
          deferred: 1,
          manualReview: 0,
          failed: 1,
          skipped: 0,
        },
      });
      expect(repo.deferAutoRenewalReconciliation).toHaveBeenLastCalledWith(
        expect.objectContaining({ paymentId: 'second' }),
      );
    },
  );

  it('다른 실행이 선점한 대사는 skipped로 집계한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    repo.findAutoRenewalPaymentsToReconcile.mockResolvedValue([
      {
        id: 'payment-id',
        subscriptionId: 'subscription-id',
        externalOrderId: 'order-id',
        amount: 4900,
        currency: 'KRW',
        renewalDueAt: createInput().now,
        renewalPeriodEnd: createInput().now,
        reconciliationAttempts: 0,
      },
    ]);
    repo.claimAutoRenewalReconciliation.mockResolvedValue(null);
    const result = await new ProcessDueAutoRenewalsUseCase(
      repo,
      gateway,
      createMailer(),
      createConfig(),
    ).execute(createInput());
    expect(result.reconciliation).toEqual({
      processed: 1,
      succeeded: 0,
      deferred: 0,
      manualReview: 0,
      failed: 0,
      skipped: 1,
    });
    expect(gateway.findPaymentByOrderId).not.toHaveBeenCalled();
  });
});
