/* eslint-disable @typescript-eslint/unbound-method */
import { UpdateMySubscriptionUseCase } from './update-my-subscription.usecase';
import { SubscriptionPaymentMailPort } from '../ports/subscription-payment-mail.port';
import { createSubscriptionsRepositoryMock as createRepository } from '../../test-support/create-subscriptions-repository-mock';
import {
  PaymentProvider,
  Subscription,
  SubscriptionAction,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../domain/subscription.types';

const createMailer = (): jest.Mocked<SubscriptionPaymentMailPort> => ({
  sendPaymentSuccess: jest.fn(),
  sendSubscriptionResumed: jest.fn(),
});

const createSubscription = (
  overrides: Partial<Subscription> = {},
): Subscription => ({
  id: 'subscription-id',
  workspaceId: 'workspace-id',
  plan: SubscriptionPlan.FREE,
  status: SubscriptionStatus.ACTIVE,
  autoRenew: false,
  startedAt: new Date('2026-02-01T00:00:00.000Z'),
  currentPeriodEnd: null,
  nextBillingAt: null,
  provider: null,
  externalBillingKey: null,
  externalCustomerKey: null,
  ...overrides,
});

describe('UpdateMySubscriptionUseCase', () => {
  it('해지 시 자동갱신만 중단하고 현재 기간은 유지한다', async () => {
    const repo = createRepository();
    const currentPeriodEnd = new Date('2099-03-01T00:00:00.000Z');

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd,
        nextBillingAt: currentPeriodEnd,
        provider: PaymentProvider.TOSS_PAYMENTS,
        externalBillingKey: 'billing-key',
        externalCustomerKey: 'customer-key',
      }),
    );
    repo.updateSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd,
        nextBillingAt: null,
      }),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo, createMailer());
    const result = await usecase.execute('user-id', {
      type: SubscriptionAction.CANCEL,
    });

    expect(repo.updateSubscription).toHaveBeenCalledWith('subscription-id', {
      status: SubscriptionStatus.CANCELED,
      autoRenew: false,
      nextBillingAt: null,
    });
    expect(result).toMatchObject({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.CANCELED,
      autoRenew: false,
      currentPeriodEnd,
    });
  });

  it('빌링키가 있는 해지 구독은 자동갱신을 재개할 수 있다', async () => {
    const repo = createRepository();
    const mailer = createMailer();
    const currentPeriodEnd = new Date('2099-03-01T00:00:00.000Z');

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd,
        provider: PaymentProvider.TOSS_PAYMENTS,
        externalBillingKey: 'billing-key',
        externalCustomerKey: 'customer-key',
      }),
    );
    repo.updateSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd,
        nextBillingAt: currentPeriodEnd,
      }),
    );
    repo.findBillingMailRecipientByUserId.mockResolvedValue({
      email: 'user@example.com',
    });

    const usecase = new UpdateMySubscriptionUseCase(repo, mailer);
    await usecase.execute('user-id', {
      type: SubscriptionAction.RESUME,
    });

    expect(repo.updateSubscription).toHaveBeenCalledWith('subscription-id', {
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
      nextBillingAt: currentPeriodEnd,
    });
    expect(mailer.sendSubscriptionResumed).toHaveBeenCalledWith({
      recipientEmail: 'user@example.com',
      plan: SubscriptionPlan.PRO,
      currentPeriodEnd,
      nextBillingAt: currentPeriodEnd,
    });
  });

  it('구독 재개 메일 발송 실패가 재개 응답을 막지 않는다', async () => {
    const repo = createRepository();
    const mailer = createMailer();
    const currentPeriodEnd = new Date('2099-03-01T00:00:00.000Z');

    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd,
        provider: PaymentProvider.TOSS_PAYMENTS,
        externalBillingKey: 'billing-key',
        externalCustomerKey: 'customer-key',
      }),
    );
    repo.updateSubscription.mockResolvedValue(
      createSubscription({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd,
        nextBillingAt: currentPeriodEnd,
      }),
    );
    repo.findBillingMailRecipientByUserId.mockResolvedValue({
      email: 'user@example.com',
    });
    mailer.sendSubscriptionResumed.mockRejectedValue(
      new Error('resend failed'),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo, mailer);

    await expect(
      usecase.execute('user-id', {
        type: SubscriptionAction.RESUME,
      }),
    ).resolves.toMatchObject({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
    });
  });

  it('FREE 상태에서 해지를 요청하면 CONFLICT를 반환한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalSubscription.mockResolvedValue(
      createSubscription(),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo, createMailer());

    await expect(
      usecase.execute('user-id', {
        type: SubscriptionAction.CANCEL,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
