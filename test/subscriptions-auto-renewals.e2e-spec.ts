import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrometheusMetricsService } from '../src/shared/infrastructure/prometheus/prometheus-metrics.service';
import { ProcessDueAutoRenewalsUseCase } from '../src/subscriptions/application/usecases/process-due-auto-renewals.usecase';
import { UpdateMySubscriptionUseCase } from '../src/subscriptions/application/usecases/update-my-subscription.usecase';
import { ConfirmBillingAuthUseCase } from '../src/subscriptions/application/usecases/confirm-billing-auth.usecase';
import { createAutoRenewalSubscriptionOrderId } from '../src/subscriptions/application/helpers/customer-key.helper';
import { PrismaSubscriptionsRepository } from '../src/subscriptions/infrastructure/prisma-subscriptions.repository';
import { TossPaymentsBillingGateway } from '../src/subscriptions/infrastructure/toss-payments-billing.gateway';

const dueAt = new Date('2026-02-01T00:00:00.000Z');
const recoveredPeriodEnd = new Date('2026-03-01T00:00:00.000Z');
const recoveryAt = new Date('2026-02-01T00:06:00.000Z');

describe('Auto-renewal reconciliation (PostgreSQL integration)', () => {
  let prisma: PrismaService;
  let secondPrisma: PrismaService;
  let repository: PrismaSubscriptionsRepository;
  let secondRepository: PrismaSubscriptionsRepository;
  let fetchMock: jest.SpyInstance<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >;
  let userId: string;
  let subscriptionId: string;
  let orderId: string;
  let paymentKey: string;
  const mailer = {
    sendPaymentSuccess: jest.fn().mockResolvedValue(undefined),
    sendSubscriptionResumed: jest.fn().mockResolvedValue(undefined),
  };
  const config = new ConfigService({
    TOSS_PAYMENTS_SECRET_KEY: 'test-secret',
    PRO_MONTHLY_AMOUNT: '4900',
    TOSS_PAYMENTS_CURRENCY: 'KRW',
    TOSS_PAYMENTS_PRO_ORDER_NAME: 'Test monthly subscription',
  });

  const createUseCase = (repo = repository) =>
    new ProcessDueAutoRenewalsUseCase(
      repo,
      new TossPaymentsBillingGateway(config),
      mailer,
      config,
    );

  const input = (now = dueAt) => ({
    now,
    accessPolicy: {
      enabled: true,
      expectedSecret: 'test-batch-secret',
      providedSecret: 'test-batch-secret',
    },
  });

  const paymentResponse = (overrides: Record<string, unknown> = {}) => ({
    paymentKey,
    orderId,
    status: 'DONE',
    totalAmount: 4900,
    currency: 'KRW',
    approvedAt: dueAt.toISOString(),
    ...overrides,
  });

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const paymentRow = () =>
    prisma.subscriptionPayment.findUniqueOrThrow({
      where: { externalOrderId: orderId },
    });

  const subscriptionRow = () =>
    prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });

  const claimParams = () => ({
    subscriptionId,
    provider: 'TOSS_PAYMENTS' as const,
    externalOrderId: orderId,
    amount: 4900,
    currency: 'KRW',
    renewalDueAt: dueAt,
    renewalPeriodEnd: dueAt,
    reconciliationNextAt: recoveryAt,
    expectedBillingKey: `billing-${userId}`,
    expectedCustomerKey: `customer-${userId}`,
    now: dueAt,
  });

  const createPendingPayment = () =>
    repository.claimAutoRenewalPayment(claimParams());

  const cancelSubscription = () =>
    new UpdateMySubscriptionUseCase(secondRepository, mailer).execute(userId, {
      type: 'CANCEL',
    });

  async function withinTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Concurrency barrier timed out')),
            3000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/test_db') {
      throw new Error(
        'Subscription integration tests require an explicit DATABASE_URL for test_db.',
      );
    }

    const metrics = {
      observeDatabaseQuery: jest.fn(),
    } as unknown as PrometheusMetricsService;
    prisma = new PrismaService(metrics);
    secondPrisma = new PrismaService(metrics);
    repository = new PrismaSubscriptionsRepository(prisma);
    secondRepository = new PrismaSubscriptionsRepository(secondPrisma);
    await Promise.all([prisma.$connect(), secondPrisma.$connect()]);
  });

  beforeEach(async () => {
    userId = randomUUID();
    subscriptionId = randomUUID();
    orderId = createAutoRenewalSubscriptionOrderId(subscriptionId, dueAt);
    paymentKey = `payment-${randomUUID()}`;
    await prisma.user.create({
      data: {
        id: userId,
        authAccounts: {
          create: {
            provider: 'GOOGLE',
            providerUserId: userId,
            email: 'renewal@example.com',
            displayName: 'Renewal test',
          },
        },
        ownedWorkspace: {
          create: {
            name: 'Renewal integration fixture',
            subscription: {
              create: {
                id: subscriptionId,
                plan: 'PRO',
                status: 'ACTIVE',
                autoRenew: true,
                startedAt: new Date('2026-01-01T00:00:00.000Z'),
                currentPeriodEnd: dueAt,
                nextBillingAt: dueAt,
                provider: 'TOSS_PAYMENTS',
                externalBillingKey: `billing-${userId}`,
                externalCustomerKey: `customer-${userId}`,
              },
            },
          },
        },
      },
    });
    fetchMock = jest.spyOn(globalThis, 'fetch');
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(paymentResponse())),
    );
    mailer.sendPaymentSuccess.mockClear();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (prisma && userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  afterAll(async () => {
    await Promise.all([prisma?.$disconnect(), secondPrisma?.$disconnect()]);
  });

  it.each(['database failure', 'transport uncertainty', 'canceled renewal'])(
    'recovers %s after a charge without charging or extending twice',
    async (scenario) => {
      if (scenario === 'transport uncertainty') {
        fetchMock.mockRejectedValueOnce(new TypeError('connection lost'));
      } else {
        jest
          .spyOn(repository, 'completeAutoRenewalPayment')
          .mockRejectedValueOnce(new Error('database unavailable'));
      }

      const first = await createUseCase().execute(input());
      expect(first.failed).toBe(1);
      expect(await paymentRow()).toMatchObject({ status: 'PENDING' });
      expect(await subscriptionRow()).toMatchObject({
        currentPeriodEnd: dueAt,
        nextBillingAt: dueAt,
      });
      expect(mailer.sendPaymentSuccess).not.toHaveBeenCalled();

      if (scenario === 'canceled renewal') {
        expect(await cancelSubscription()).toMatchObject({
          autoRenew: false,
          cancellation: { pendingRenewalPayment: true },
        });
      }

      // Reconstruct using another connection to simulate a later process run.
      const recovered = await createUseCase(secondRepository).execute(
        input(recoveryAt),
      );
      expect(recovered.reconciliation.succeeded).toBe(1);
      expect(await paymentRow()).toMatchObject({
        status: 'DONE',
        externalPaymentKey: paymentKey,
      });
      expect(await subscriptionRow()).toMatchObject({
        currentPeriodEnd: recoveredPeriodEnd,
        autoRenew: scenario !== 'canceled renewal',
        nextBillingAt:
          scenario === 'canceled renewal' ? null : recoveredPeriodEnd,
      });

      await createUseCase().execute(input(recoveryAt));
      expect((await subscriptionRow()).currentPeriodEnd).toEqual(
        recoveredPeriodEnd,
      );
      expect(
        await prisma.subscriptionPayment.count({ where: { subscriptionId } }),
      ).toBe(1);
      expect(
        fetchMock.mock.calls.map(([, options]) => options?.method),
      ).toEqual(['POST', 'GET']);
      expect(fetchMock.mock.calls[1][0]).toBe(
        `https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(orderId)}`,
      );
    },
  );

  it('does not claim or charge a stale candidate after cancellation completes', async () => {
    const candidates = await repository.findDueAutoRenewalSubscriptions(
      dueAt,
      50,
    );
    expect(candidates.map((subscription) => subscription.id)).toContain(
      subscriptionId,
    );
    jest
      .spyOn(repository, 'findDueAutoRenewalSubscriptions')
      .mockImplementationOnce(async () => {
        expect(await cancelSubscription()).toMatchObject({
          autoRenew: false,
          cancellation: { pendingRenewalPayment: false },
        });
        return candidates;
      });

    await createUseCase().execute(input());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await prisma.subscriptionPayment.count({ where: { subscriptionId } }),
    ).toBe(0);
    expect(await subscriptionRow()).toMatchObject({
      status: 'CANCELED',
      autoRenew: false,
      nextBillingAt: null,
      currentPeriodEnd: dueAt,
    });
  });

  it('cancels during an in-flight charge without waiting for its response', async () => {
    let signalPostStarted!: () => void;
    const postStarted = new Promise<void>((resolve) => {
      signalPostStarted = resolve;
    });
    let releaseResponse!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      releaseResponse = resolve;
    });
    fetchMock.mockImplementationOnce(() => {
      signalPostStarted();
      return response;
    });
    const batch = createUseCase().execute(input());
    let cancellation: ReturnType<typeof cancelSubscription> | undefined;
    try {
      await withinTimeout(postStarted);
      cancellation = cancelSubscription();
      expect(await withinTimeout(cancellation)).toMatchObject({
        status: 'CANCELED',
        autoRenew: false,
        nextBillingAt: null,
        currentPeriodEnd: dueAt,
        cancellation: { pendingRenewalPayment: true },
      });
      releaseResponse(jsonResponse(paymentResponse()));
      expect(await batch).toMatchObject({ succeeded: 1 });
      expect(await paymentRow()).toMatchObject({ status: 'DONE' });
      expect(await subscriptionRow()).toMatchObject({
        status: 'CANCELED',
        autoRenew: false,
        nextBillingAt: null,
        currentPeriodEnd: recoveredPeriodEnd,
      });
      expect(
        fetchMock.mock.calls.map(([, options]) => options?.method),
      ).toEqual(['POST']);
    } finally {
      releaseResponse(jsonResponse(paymentResponse()));
      await Promise.allSettled([
        batch,
        ...(cancellation ? [cancellation] : []),
      ]);
    }
  });

  it('cancels after completion without losing the paid period or reporting a pending charge', async () => {
    expect(await createUseCase().execute(input())).toMatchObject({
      succeeded: 1,
    });

    expect(await cancelSubscription()).toMatchObject({
      status: 'CANCELED',
      autoRenew: false,
      nextBillingAt: null,
      currentPeriodEnd: recoveredPeriodEnd,
      cancellation: { pendingRenewalPayment: false },
    });
    expect(await subscriptionRow()).toMatchObject({
      autoRenew: false,
      nextBillingAt: null,
      currentPeriodEnd: recoveredPeriodEnd,
    });
    expect(await paymentRow()).toMatchObject({ status: 'DONE' });
  });

  it.each(['subscription update', 'billing auth'])(
    'resumes with the latest paid period through %s despite a stale read',
    async (path) => {
      const previousEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const extendedEnd = new Date(
        previousEnd.getTime() + 30 * 24 * 60 * 60 * 1000,
      );
      const staleSubscription = await repository.updateSubscription(
        subscriptionId,
        {
          status: 'CANCELED',
          autoRenew: false,
          nextBillingAt: null,
          currentPeriodEnd: previousEnd,
        },
      );
      await secondRepository.updateSubscription(subscriptionId, {
        currentPeriodEnd: extendedEnd,
      });
      jest
        .spyOn(repository, 'getOrCreatePersonalSubscription')
        .mockResolvedValueOnce(staleSubscription);

      const result =
        path === 'subscription update'
          ? await new UpdateMySubscriptionUseCase(repository, mailer).execute(
              userId,
              { type: 'RESUME' },
            )
          : await new ConfirmBillingAuthUseCase(
              repository,
              new TossPaymentsBillingGateway(config),
              mailer,
              config,
            ).execute(userId, {
              authKey: 'unused-resume-auth-key',
              customerKey: `customer-${userId}`,
            });

      expect(result).toMatchObject({
        autoRenew: true,
        currentPeriodEnd: extendedEnd,
        nextBillingAt: extendedEnd,
      });
      expect(await subscriptionRow()).toMatchObject({
        autoRenew: true,
        currentPeriodEnd: extendedEnd,
        nextBillingAt: extendedEnd,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(['billing key', 'customer key', 'billing date'])(
    'rejects a claim with a stale %s',
    async (field) => {
      const params = claimParams();
      await secondRepository.updateSubscription(
        subscriptionId,
        field === 'billing key'
          ? { externalBillingKey: 'replaced-billing-key' }
          : field === 'customer key'
            ? { externalCustomerKey: 'replaced-customer-key' }
            : { nextBillingAt: new Date(dueAt.getTime() - 1000) },
      );

      expect(await repository.claimAutoRenewalPayment(params)).toBe(false);
      expect(
        await prisma.subscriptionPayment.count({ where: { subscriptionId } }),
      ).toBe(0);
    },
  );

  it('rejects a different order while a renewal payment remains pending', async () => {
    expect(await createPendingPayment()).toBe(true);
    expect(
      await secondRepository.claimAutoRenewalPayment({
        ...claimParams(),
        externalOrderId: `other-${orderId}`,
      }),
    ).toBe(false);
    expect(
      await prisma.subscriptionPayment.count({ where: { subscriptionId } }),
    ).toBe(1);
    expect(await paymentRow()).toMatchObject({ status: 'PENDING' });
  });

  it('rejects billing authentication for an expired canceled period with an unresolved renewal', async () => {
    expect(await createPendingPayment()).toBe(true);
    expect(await cancelSubscription()).toMatchObject({
      status: 'CANCELED',
      currentPeriodEnd: dueAt,
      cancellation: { pendingRenewalPayment: true },
    });

    await expect(
      new ConfirmBillingAuthUseCase(
        repository,
        new TossPaymentsBillingGateway(config),
        mailer,
        config,
      ).execute(userId, {
        authKey: 'unused-pending-renewal-auth-key',
        customerKey: `customer-${userId}`,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await subscriptionRow()).toMatchObject({
      status: 'CANCELED',
      autoRenew: false,
      nextBillingAt: null,
      currentPeriodEnd: dueAt,
    });
    expect(await paymentRow()).toMatchObject({ status: 'PENDING' });
    expect(
      await prisma.subscriptionPayment.count({ where: { subscriptionId } }),
    ).toBe(1);
  });

  it('allows only one completion through independent database connections', async () => {
    await createPendingPayment();
    const params = {
      externalOrderId: orderId,
      externalPaymentKey: paymentKey,
      amount: 4900,
      currency: 'KRW',
      approvedAt: dueAt,
      currentPeriodEnd: recoveredPeriodEnd,
      rawData: paymentResponse(),
    };

    const results = await Promise.all([
      repository.completeAutoRenewalPayment(params),
      secondRepository.completeAutoRenewalPayment(params),
    ]);

    expect(results.filter((result) => result !== null)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);
    expect(await paymentRow()).toMatchObject({ status: 'DONE' });
    expect((await subscriptionRow()).currentPeriodEnd).toEqual(
      recoveredPeriodEnd,
    );
    expect(await repository.completeAutoRenewalPayment(params)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rolls back the payment completion when the subscription write fails', async () => {
    await createPendingPayment();
    let failSubscriptionUpdate = true;
    const extendedPrisma = prisma.$extends({
      query: {
        subscription: {
          update({ args, query }) {
            if (failSubscriptionUpdate) {
              failSubscriptionUpdate = false;
              throw new Error('injected subscription write failure');
            }
            return query(args);
          },
        },
      },
    });
    const failingRepository = new PrismaSubscriptionsRepository(
      extendedPrisma as unknown as PrismaService,
    );
    const params = {
      externalOrderId: orderId,
      externalPaymentKey: paymentKey,
      amount: 4900,
      currency: 'KRW',
      approvedAt: dueAt,
      currentPeriodEnd: recoveredPeriodEnd,
      rawData: paymentResponse(),
    };

    await expect(
      failingRepository.completeAutoRenewalPayment(params),
    ).rejects.toThrow('injected subscription write failure');

    expect(await paymentRow()).toMatchObject({
      status: 'PENDING',
      externalPaymentKey: null,
      approvedAt: null,
      reconciliationNextAt: recoveryAt,
    });
    expect(await subscriptionRow()).toMatchObject({
      currentPeriodEnd: dueAt,
      nextBillingAt: dueAt,
    });

    await expect(
      failingRepository.completeAutoRenewalPayment(params),
    ).resolves.toMatchObject({ currentPeriodEnd: recoveredPeriodEnd });
    expect(await paymentRow()).toMatchObject({
      status: 'DONE',
      externalPaymentKey: paymentKey,
    });
  });

  it('preserves a later period when reconciling an older payment snapshot', async () => {
    await createPendingPayment();
    const laterPeriodEnd = new Date('2026-04-01T00:00:00.000Z');
    await repository.updateSubscription(subscriptionId, {
      currentPeriodEnd: laterPeriodEnd,
      nextBillingAt: laterPeriodEnd,
    });

    const result = await createUseCase().execute(input(recoveryAt));

    expect(result.reconciliation.succeeded).toBe(1);
    expect(await paymentRow()).toMatchObject({ status: 'DONE' });
    expect(await subscriptionRow()).toMatchObject({
      currentPeriodEnd: laterPeriodEnd,
      nextBillingAt: laterPeriodEnd,
    });
    await createUseCase(secondRepository).execute(input(recoveryAt));
    expect((await subscriptionRow()).currentPeriodEnd).toEqual(laterPeriodEnd);
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual([
      'GET',
    ]);
  });

  it('preserves legacy pending orders for manual review during migration', async () => {
    const migration = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260908060000_add_auto_renewal_reconciliation/migration.sql',
      ),
      'utf8',
    );
    await prisma.$transaction(async (tx) => {
      // The temporary legacy table shadows only this transaction's public table.
      await tx.$executeRaw`CREATE TEMP TABLE "SubscriptionPayment" ("id" TEXT, "status" TEXT, "amount" INTEGER) ON COMMIT DROP`;
      await tx.$executeRaw`INSERT INTO "SubscriptionPayment" VALUES ('legacy-pending', 'PENDING', 4900), ('legacy-done', 'DONE', 4900)`;
      for (const statement of migration
        .split(';')
        .filter((sql) => sql.trim())) {
        await tx.$executeRawUnsafe(statement);
      }
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          amount: number;
          manualReviewAt: Date | null;
          reconciliationNextAt: Date | null;
          reconciliationError: string | null;
        }>
      >`SELECT "id", "status", "amount", "manualReviewAt", "reconciliationNextAt", "reconciliationError" FROM "SubscriptionPayment" ORDER BY "id"`;
      expect(rows[0]).toMatchObject({
        id: 'legacy-done',
        status: 'DONE',
        amount: 4900,
        manualReviewAt: null,
      });
      expect(rows[1]).toMatchObject({
        id: 'legacy-pending',
        status: 'PENDING',
        amount: 4900,
        reconciliationNextAt: null,
        reconciliationError: 'LEGACY_PERIOD_SNAPSHOT_MISSING',
      });
      expect(rows[1].manualReviewAt).toBeInstanceOf(Date);
    });
  });

  it('does not let a stale expiration overwrite a recovered paid period', async () => {
    await createPendingPayment();
    await repository.updateSubscription(subscriptionId, {
      autoRenew: false,
      status: 'CANCELED',
      nextBillingAt: null,
    });
    const restoredEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await repository.completeAutoRenewalPayment({
      externalOrderId: orderId,
      externalPaymentKey: paymentKey,
      amount: 4900,
      currency: 'KRW',
      approvedAt: dueAt,
      currentPeriodEnd: restoredEnd,
      rawData: paymentResponse(),
    });

    const result = await secondRepository.expireSubscriptionIfUnchanged(
      subscriptionId,
      dueAt,
    );

    expect(result).toMatchObject({
      plan: 'PRO',
      autoRenew: false,
      currentPeriodEnd: restoredEnd,
    });
    expect(await paymentRow()).toMatchObject({ status: 'DONE' });
  });

  it('leases a pending reconciliation once across overlapping batch runs', async () => {
    await createPendingPayment();

    const results = await Promise.all([
      createUseCase().execute(input(recoveryAt)),
      createUseCase(secondRepository).execute(input(recoveryAt)),
    ]);

    expect(
      results.reduce((sum, result) => sum + result.reconciliation.succeeded, 0),
    ).toBe(1);
    expect(await paymentRow()).toMatchObject({ status: 'DONE' });
    expect((await subscriptionRow()).currentPeriodEnd).toEqual(
      recoveredPeriodEnd,
    );
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual([
      'GET',
    ]);
  });

  it.each([
    ['wrong amount', { totalAmount: 1 }],
    ['wrong order', { orderId: 'another-order' }],
    ['wrong currency', { currency: 'USD' }],
    ['in progress', { status: 'IN_PROGRESS' }],
    ['partially canceled', { status: 'PARTIAL_CANCELED' }],
    ['invalid approval time', { approvedAt: 'invalid-date' }],
  ])('does not grant a period for %s', async (_label, overrides) => {
    await createPendingPayment();
    fetchMock.mockResolvedValue(jsonResponse(paymentResponse(overrides)));

    const result = await createUseCase().execute(input(recoveryAt));

    expect(result.reconciliation.succeeded).toBe(0);
    expect(await paymentRow()).toMatchObject({ status: 'PENDING' });
    expect((await subscriptionRow()).currentPeriodEnd).toEqual(dueAt);
    expect(mailer.sendPaymentSuccess).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual([
      'GET',
    ]);
  });

  it.each([
    ['not found', 404, 'NOT_FOUND_PAYMENT'],
    ['provider outage', 500, 'INTERNAL_SERVER_ERROR'],
  ])(
    'defers %s while preserving the pending charge',
    async (_label, status, code) => {
      await createPendingPayment();
      fetchMock.mockResolvedValue(jsonResponse({ code }, status));

      const result = await createUseCase().execute(input(recoveryAt));

      expect(result.reconciliation).toMatchObject({
        succeeded: 0,
        deferred: 1,
      });
      const pending = await paymentRow();
      expect(pending).toMatchObject({
        status: 'PENDING',
        reconciliationAttempts: 1,
        manualReviewAt: null,
      });
      expect(pending.reconciliationNextAt?.getTime()).toBeGreaterThan(
        recoveryAt.getTime(),
      );
      expect((await subscriptionRow()).currentPeriodEnd).toEqual(dueAt);
      expect(
        fetchMock.mock.calls.map(([, options]) => options?.method),
      ).toEqual(['GET']);
    },
  );

  it('stops automatic lookup after the final unsuccessful attempt', async () => {
    await createPendingPayment();
    await prisma.subscriptionPayment.update({
      where: { externalOrderId: orderId },
      data: { reconciliationAttempts: 11 },
    });
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ code: 'NOT_FOUND_PAYMENT' }, 404)),
    );

    const result = await createUseCase().execute(input(recoveryAt));

    expect(result.reconciliation.manualReview).toBe(1);
    expect(await paymentRow()).toMatchObject({
      status: 'PENDING',
      reconciliationAttempts: 12,
      reconciliationNextAt: null,
      manualReviewAt: recoveryAt,
    });
    await createUseCase().execute(input(new Date('2026-02-01T01:00:00.000Z')));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await subscriptionRow()).currentPeriodEnd).toEqual(dueAt);
  });
});
