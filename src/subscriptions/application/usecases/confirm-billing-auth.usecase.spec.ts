/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { ConfirmBillingAuthUseCase } from './confirm-billing-auth.usecase';
import { BillingPaymentGateway } from '../ports/billing-payment.gateway';
import { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import {
  PaymentProvider,
  Subscription,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';

const createSubscription = (
  overrides: Partial<Subscription> = {},
): Subscription => ({
  id: 'subscription-id',
  workspaceId: 'workspace-id',
  plan: SubscriptionPlan.FREE,
  status: SubscriptionStatus.ACTIVE,
  autoRenew: false,
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: null,
  nextBillingAt: null,
  provider: PaymentProvider.TOSS_PAYMENTS,
  externalBillingKey: null,
  externalCustomerKey: 'customer-key',
  ...overrides,
});

const createRepository = (): jest.Mocked<SubscriptionsRepository> => ({
  getOrCreatePersonalSubscription: jest.fn(),
  findBillingMailRecipientByUserId: jest.fn(),
  findBillingMailRecipientBySubscriptionId: jest.fn(),
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

describe('ConfirmBillingAuthUseCase', () => {
  it('최초 결제 성공 시 PRO 구독을 생성하고 자동갱신을 활성화한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();
    const approvedAt = new Date('2026-02-01T00:00:00.000Z');
    const periodEnd = new Date('2026-03-01T00:00:00.000Z');

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription(),
    );
    gateway.issueBillingKey.mockResolvedValue({
      billingKey: 'billing-key',
      authenticatedAt: approvedAt,
      method: '카드',
      rawData: {},
    });
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'order-id',
      status: SubscriptionPaymentStatus.DONE,
      totalAmount: 4900,
      currency: 'KRW',
      approvedAt,
      failureCode: null,
      failureMessage: null,
      rawData: {},
    });
    repo.activateByPayment.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        externalBillingKey: 'billing-key',
        currentPeriodEnd: periodEnd,
        nextBillingAt: periodEnd,
      }),
    );
    repo.findBillingMailRecipientByUserId.mockResolvedValue({
      email: 'user@example.com',
    });

    const usecase = new ConfirmBillingAuthUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );
    const result = await usecase.execute('user-id', {
      authKey: 'auth-key',
      customerKey: 'customer-key',
    });

    expect(repo.activateByPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'subscription-id',
        provider: PaymentProvider.TOSS_PAYMENTS,
        status: SubscriptionPaymentStatus.DONE,
        externalBillingKey: 'billing-key',
        externalCustomerKey: 'customer-key',
        externalPaymentKey: 'payment-key',
        amount: 4900,
        currency: 'KRW',
      }),
    );
    expect(result).toMatchObject({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
      nextBillingAt: periodEnd,
    });
    expect(mailer.sendPaymentSuccess).toHaveBeenCalledWith({
      recipientEmail: 'user@example.com',
      amount: 4900,
      currency: 'KRW',
      approvedAt,
      plan: SubscriptionPlan.PRO,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd,
      paymentKind: 'INITIAL',
    });
  });

  it('활성 PRO 구독은 기존 만료일 뒤로 1개월 연장한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();
    const currentPeriodEnd = new Date('2026-04-01T00:00:00.000Z');

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        startedAt: new Date('2026-02-01T00:00:00.000Z'),
        currentPeriodEnd,
      }),
    );
    gateway.issueBillingKey.mockResolvedValue({
      billingKey: 'billing-key',
      authenticatedAt: new Date('2026-02-01T00:00:00.000Z'),
      method: '카드',
      rawData: {},
    });
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'order-id',
      status: SubscriptionPaymentStatus.DONE,
      totalAmount: 4900,
      currency: 'KRW',
      approvedAt: new Date('2026-03-01T00:00:00.000Z'),
      failureCode: null,
      failureMessage: null,
      rawData: {},
    });
    repo.activateByPayment.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
      }),
    );
    repo.findBillingMailRecipientByUserId.mockResolvedValue({
      email: 'user@example.com',
    });

    const usecase = new ConfirmBillingAuthUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );
    await usecase.execute('user-id', {
      authKey: 'auth-key',
      customerKey: 'customer-key',
    });

    expect(repo.activateByPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        nextBillingAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    );
  });

  it('남은 기간이 있는 해지 구독은 즉시 결제 없이 자동갱신만 재개한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();
    const currentPeriodEnd = new Date('2099-04-01T00:00:00.000Z');

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.CANCELED,
        autoRenew: false,
        startedAt: new Date('2026-02-01T00:00:00.000Z'),
        currentPeriodEnd,
        nextBillingAt: null,
        externalBillingKey: 'billing-key',
        externalCustomerKey: 'customer-key',
      }),
    );
    repo.updateSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        startedAt: new Date('2026-02-01T00:00:00.000Z'),
        currentPeriodEnd,
        nextBillingAt: currentPeriodEnd,
        externalBillingKey: 'billing-key',
        externalCustomerKey: 'customer-key',
      }),
    );
    repo.findBillingMailRecipientByUserId.mockResolvedValue({
      email: 'user@example.com',
    });

    const usecase = new ConfirmBillingAuthUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );
    const result = await usecase.execute('user-id', {
      authKey: 'auth-key',
      customerKey: 'customer-key',
    });

    expect(gateway.issueBillingKey).not.toHaveBeenCalled();
    expect(gateway.chargeBilling).not.toHaveBeenCalled();
    expect(repo.activateByPayment).not.toHaveBeenCalled();
    expect(repo.recordPaymentFailure).not.toHaveBeenCalled();
    expect(mailer.sendPaymentSuccess).not.toHaveBeenCalled();
    expect(mailer.sendSubscriptionResumed).toHaveBeenCalledWith({
      recipientEmail: 'user@example.com',
      plan: SubscriptionPlan.PRO,
      currentPeriodEnd,
      nextBillingAt: currentPeriodEnd,
    });
    expect(repo.updateSubscription).toHaveBeenCalledWith('subscription-id', {
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
      nextBillingAt: currentPeriodEnd,
    });
    expect(result).toMatchObject({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
      currentPeriodEnd,
      nextBillingAt: currentPeriodEnd,
    });
  });

  it('결제 실패 시 구독을 변경하지 않고 실패 이력만 저장한다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription(),
    );
    gateway.issueBillingKey.mockResolvedValue({
      billingKey: 'billing-key',
      authenticatedAt: new Date('2026-02-01T00:00:00.000Z'),
      method: '카드',
      rawData: {},
    });
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'order-id',
      status: SubscriptionPaymentStatus.FAILED,
      totalAmount: 4900,
      currency: 'KRW',
      approvedAt: null,
      failureCode: 'REJECT_CARD',
      failureMessage: '카드 승인 실패',
      rawData: {},
    });

    const usecase = new ConfirmBillingAuthUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );

    await expect(
      usecase.execute('user-id', {
        authKey: 'auth-key',
        customerKey: 'customer-key',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(repo.recordPaymentFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubscriptionPaymentStatus.FAILED,
        failureCode: 'REJECT_CARD',
      }),
    );
    expect(repo.activateByPayment).not.toHaveBeenCalled();
    expect(mailer.sendPaymentSuccess).not.toHaveBeenCalled();
  });

  it('결제 성공 메일 발송 실패가 결제 성공 응답을 막지 않는다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();
    const approvedAt = new Date('2026-02-01T00:00:00.000Z');
    const periodEnd = new Date('2026-03-01T00:00:00.000Z');

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription(),
    );
    gateway.issueBillingKey.mockResolvedValue({
      billingKey: 'billing-key',
      authenticatedAt: approvedAt,
      method: '카드',
      rawData: {},
    });
    gateway.chargeBilling.mockResolvedValue({
      paymentKey: 'payment-key',
      orderId: 'order-id',
      status: SubscriptionPaymentStatus.DONE,
      totalAmount: 4900,
      currency: 'KRW',
      approvedAt,
      failureCode: null,
      failureMessage: null,
      rawData: {},
    });
    repo.activateByPayment.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        externalBillingKey: 'billing-key',
        currentPeriodEnd: periodEnd,
        nextBillingAt: periodEnd,
      }),
    );
    repo.findBillingMailRecipientByUserId.mockResolvedValue({
      email: 'user@example.com',
    });
    mailer.sendPaymentSuccess.mockRejectedValue(new Error('resend failed'));

    const usecase = new ConfirmBillingAuthUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );

    await expect(
      usecase.execute('user-id', {
        authKey: 'auth-key',
        customerKey: 'customer-key',
      }),
    ).resolves.toMatchObject({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
    });
  });

  it('구독 재개 메일 발송 실패가 즉시 결제 없는 재개 응답을 막지 않는다', async () => {
    const repo = createRepository();
    const gateway = createGateway();
    const mailer = createMailer();
    const currentPeriodEnd = new Date('2099-04-01T00:00:00.000Z');

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.CANCELED,
        autoRenew: false,
        startedAt: new Date('2026-02-01T00:00:00.000Z'),
        currentPeriodEnd,
        nextBillingAt: null,
        externalBillingKey: 'billing-key',
        externalCustomerKey: 'customer-key',
      }),
    );
    repo.updateSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        startedAt: new Date('2026-02-01T00:00:00.000Z'),
        currentPeriodEnd,
        nextBillingAt: currentPeriodEnd,
        externalBillingKey: 'billing-key',
        externalCustomerKey: 'customer-key',
      }),
    );
    repo.findBillingMailRecipientByUserId.mockResolvedValue({
      email: 'user@example.com',
    });
    mailer.sendSubscriptionResumed.mockRejectedValue(
      new Error('resend failed'),
    );

    const usecase = new ConfirmBillingAuthUseCase(
      repo,
      gateway,
      mailer,
      createConfig(),
    );

    await expect(
      usecase.execute('user-id', {
        authKey: 'auth-key',
        customerKey: 'customer-key',
      }),
    ).resolves.toMatchObject({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
    });
  });
});
