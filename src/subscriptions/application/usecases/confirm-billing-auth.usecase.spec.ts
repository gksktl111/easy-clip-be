/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { ConfirmBillingAuthUseCase } from './confirm-billing-auth.usecase';
import { ReconcileInitialPaymentsUseCase } from './reconcile-initial-payments.usecase';
import { GetInitialPaymentUseCase } from './get-initial-payment.usecase';
import { BillingPaymentGateway } from '../ports/billing-payment.gateway';
import { createSubscriptionsRepositoryMock } from '../../test-support/create-subscriptions-repository-mock';
import { resolveProMonthlyPrice } from '../helpers/pro-monthly-price.helper';
import { InitialPaymentAttempt } from '../../domain/subscriptions.repository';
import { Subscription } from '../../domain/subscription.types';

const config = new ConfigService({ PRO_MONTHLY_AMOUNT: '4900' });
const subscription: Subscription = {
  id: 'sub',
  workspaceId: 'workspace',
  plan: 'FREE',
  status: 'ACTIVE',
  autoRenew: false,
  startedAt: new Date(),
  currentPeriodEnd: null,
  nextBillingAt: null,
  provider: null,
  externalBillingKey: null,
  externalCustomerKey: 'customer',
};
const input = {
  authKey: 'auth',
  customerKey: 'customer',
  idempotencyKey: '55555555-5555-4555-8555-555555555555',
  priceVersion: resolveProMonthlyPrice(config).priceVersion,
};

function fixture() {
  const repo = createSubscriptionsRepositoryMock();
  const gateway: jest.Mocked<BillingPaymentGateway> = {
    issueBillingKey: jest.fn(),
    chargeBilling: jest.fn(),
    findPaymentByOrderId: jest.fn(),
  };
  const mailer = {
    sendPaymentSuccess: jest.fn(),
    sendSubscriptionResumed: jest.fn(),
  };
  const attempt: InitialPaymentAttempt = {
    id: 'attempt',
    subscriptionId: 'sub',
    idempotencyKey: input.idempotencyKey,
    externalOrderId: 'order',
    status: 'PENDING',
    amount: 4900,
    currency: 'KRW',
    priceVersion: input.priceVersion,
    customerKey: 'customer',
    billingKey: null,
    createdAt: new Date(),
  };
  const payment = {
    paymentKey: 'payment',
    orderId: 'order',
    status: 'DONE',
    totalAmount: 4900,
    currency: 'KRW',
    approvedAt: new Date(),
    failureCode: null,
    failureMessage: null,
    rawData: {},
  };
  repo.getOrCreatePersonalSubscription.mockResolvedValue({ ...subscription });
  repo.claimInitialPayment.mockResolvedValue({ attempt, claimed: true });
  repo.completeInitialPayment.mockResolvedValue({
    ...subscription,
    plan: 'PRO',
    autoRenew: true,
  });
  gateway.issueBillingKey.mockResolvedValue({
    billingKey: 'billing',
    authenticatedAt: new Date(),
    method: 'CARD',
    rawData: {},
  });
  gateway.chargeBilling.mockResolvedValue(payment);
  const usecase = new ConfirmBillingAuthUseCase(
    repo,
    gateway,
    mailer,
    config,
    new ReconcileInitialPaymentsUseCase(repo, gateway, mailer),
  );
  const reconcile = new ReconcileInitialPaymentsUseCase(repo, gateway, mailer);
  return { repo, gateway, mailer, attempt, payment, usecase, reconcile };
}

describe('Initial payment durability', () => {
  it('persists the claim and billing key before charging, then commits PRO', async () => {
    const f = fixture();
    f.gateway.issueBillingKey.mockImplementation(() => {
      expect(f.repo.claimInitialPayment).toHaveBeenCalledTimes(1);
      return Promise.resolve({
        billingKey: 'billing',
        authenticatedAt: new Date(),
        method: 'CARD',
        rawData: {},
      });
    });
    f.gateway.chargeBilling.mockImplementation(() => {
      expect(f.repo.saveInitialBillingKey).toHaveBeenCalledWith(
        'attempt',
        'billing',
      );
      return Promise.resolve(f.payment);
    });
    await expect(f.usecase.execute('user', input)).resolves.toMatchObject({
      status: 'DONE',
      subscription: { plan: 'PRO' },
    });
    expect(f.gateway.chargeBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order',
        amount: 4900,
        idempotencyKey: 'attempt:charge',
      }),
    );
  });

  it.each([
    'cm123456789012345678901234',
    '55555555-5555-4555-8555-555555555555',
  ])(
    'sends a provider-compatible order ID for subscription %s',
    async (subscriptionId) => {
      const f = fixture();
      f.repo.getOrCreatePersonalSubscription.mockResolvedValue({
        ...subscription,
        id: subscriptionId,
      });
      f.repo.claimInitialPayment.mockImplementation((params) => {
        f.attempt.externalOrderId = params.externalOrderId;
        f.payment.orderId = params.externalOrderId;
        return Promise.resolve({ attempt: f.attempt, claimed: true });
      });
      await expect(f.usecase.execute('user', input)).resolves.toMatchObject({
        status: 'DONE',
      });
      const charged = f.gateway.chargeBilling.mock.calls[0][0];
      expect(charged.orderId).toMatch(/^[A-Za-z0-9_-]{6,64}$/);
      expect(charged.orderId).toBe(
        f.repo.claimInitialPayment.mock.calls[0][0].externalOrderId,
      );
    },
  );

  it('replays a completed key with its saved quote despite a changed price', async () => {
    const f = fixture();
    f.repo.findInitialPayment.mockResolvedValue({
      ...f.attempt,
      status: 'DONE',
    });
    await expect(
      f.usecase.execute('user', { ...input, priceVersion: 'old-price' }),
    ).resolves.toMatchObject({ status: 'DONE', amount: 4900 });
    expect(f.repo.claimInitialPayment).not.toHaveBeenCalled();
    expect(f.gateway.issueBillingKey).not.toHaveBeenCalled();
    expect(f.gateway.chargeBilling).not.toHaveBeenCalled();
  });

  it('rejects stale price before claiming or calling the provider', async () => {
    const f = fixture();
    await expect(
      f.usecase.execute('user', { ...input, priceVersion: 'stale' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(f.repo.claimInitialPayment).not.toHaveBeenCalled();
    expect(f.gateway.issueBillingKey).not.toHaveBeenCalled();
  });

  it('a competing key cannot charge when the durable claim is denied', async () => {
    const f = fixture();
    f.repo.claimInitialPayment.mockResolvedValue(null);
    await expect(f.usecase.execute('user', input)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(f.gateway.issueBillingKey).not.toHaveBeenCalled();
  });

  it.each(['issue', 'charge', 'commit'])(
    'preserves pending after %s failure and never charges on retry',
    async (failure) => {
      const f = fixture();
      if (failure === 'issue')
        f.gateway.issueBillingKey.mockRejectedValue(new Error('timeout'));
      if (failure === 'charge')
        f.gateway.chargeBilling.mockRejectedValue(new Error('timeout'));
      if (failure === 'commit')
        f.repo.completeInitialPayment.mockRejectedValueOnce(
          new Error('db unavailable'),
        );
      await expect(f.usecase.execute('user', input)).resolves.toMatchObject({
        status: 'PENDING',
      });
      f.repo.findInitialPayment.mockResolvedValue(f.attempt);
      f.gateway.findPaymentByOrderId.mockResolvedValue(
        failure === 'issue' ? null : f.payment,
      );
      await expect(f.usecase.execute('user', input)).resolves.toMatchObject({
        status: failure === 'issue' ? 'PENDING' : 'DONE',
      });
      expect(f.gateway.issueBillingKey).toHaveBeenCalledTimes(1);
      expect(f.gateway.chargeBilling).toHaveBeenCalledTimes(
        failure === 'issue' ? 0 : 1,
      );
      expect(f.repo.failInitialPayment).not.toHaveBeenCalled();
    },
  );

  it.each([
    { orderId: 'other' },
    { totalAmount: 1 },
    { currency: 'USD' },
    { paymentKey: '' },
    { approvedAt: null },
    { approvedAt: new Date('invalid') },
    { approvedAt: new Date('2000-01-01') },
    { status: 'IN_PROGRESS' },
  ])(
    'keeps mismatched or uncertain provider results pending: %p',
    async (mismatch) => {
      const f = fixture();
      f.gateway.chargeBilling.mockResolvedValue({ ...f.payment, ...mismatch });
      await expect(f.usecase.execute('user', input)).resolves.toMatchObject({
        status: 'PENDING',
      });
      expect(f.repo.completeInitialPayment).not.toHaveBeenCalled();
      expect(f.repo.failInitialPayment).not.toHaveBeenCalled();
    },
  );

  it('owner lookup never exposes another subscription attempt or contacts provider', async () => {
    const f = fixture();
    await expect(
      new GetInitialPaymentUseCase(f.repo).execute(
        'other-user',
        input.idempotencyKey,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f.repo.findInitialPayment).toHaveBeenCalledWith(
      subscription.id,
      input.idempotencyKey,
    );
    expect(f.gateway.findPaymentByOrderId).not.toHaveBeenCalled();
  });

  it('batch recovers a saved pending payment without frontend participation', async () => {
    const f = fixture();
    f.attempt.billingKey = 'billing';
    f.repo.findPendingInitialPayments.mockResolvedValue([f.attempt]);
    f.gateway.findPaymentByOrderId.mockResolvedValue(f.payment);
    await expect(f.reconcile.executeBatch()).resolves.toEqual({
      processed: 1,
      pending: 0,
    });
    expect(f.gateway.chargeBilling).not.toHaveBeenCalled();
  });

  it('resumes a canceled paid period without charging and tolerates mail failure', async () => {
    const f = fixture();
    const canceled: Subscription = {
      ...subscription,
      plan: 'PRO',
      status: 'CANCELED',
      currentPeriodEnd: new Date('2099-01-01'),
      externalBillingKey: 'billing',
    };
    f.repo.getOrCreatePersonalSubscription.mockResolvedValue(canceled);
    f.repo.resumeAutoRenewal.mockResolvedValue({
      ...canceled,
      status: 'ACTIVE',
      autoRenew: true,
      nextBillingAt: canceled.currentPeriodEnd,
    });
    f.repo.findBillingMailRecipientByUserId.mockResolvedValue({
      email: 'receipt@example.test',
    });
    f.mailer.sendSubscriptionResumed.mockRejectedValue(
      new Error('mail unavailable'),
    );
    await expect(f.usecase.execute('user', input)).resolves.toMatchObject({
      status: 'DONE',
      subscription: { autoRenew: true },
    });
    expect(f.gateway.issueBillingKey).not.toHaveBeenCalled();
  });
});
