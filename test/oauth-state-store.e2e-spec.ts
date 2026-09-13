import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaOAuthStateStore } from '../src/auth/infrastructure/prisma-oauth-state.store';
import { PrometheusMetricsService } from '../src/shared/infrastructure/prometheus/prometheus-metrics.service';

describe('OAuth state consumption (PostgreSQL integration)', () => {
  let prisma: PrismaService;
  let secondPrisma: PrismaService;
  let store: PrismaOAuthStateStore;
  let secondStore: PrismaOAuthStateStore;
  const ids: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/test_db') {
      throw new Error(
        'OAuth state integration tests require an explicit DATABASE_URL for test_db.',
      );
    }
    const metrics = {
      observeDatabaseQuery: jest.fn(),
    } as unknown as PrometheusMetricsService;
    prisma = new PrismaService(metrics);
    secondPrisma = new PrismaService(metrics);
    await Promise.all([prisma.$connect(), secondPrisma.$connect()]);
    store = new PrismaOAuthStateStore(prisma);
    secondStore = new PrismaOAuthStateStore(secondPrisma);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.oAuthStateNonce.deleteMany({ where: { id: { in: ids } } });
    }
    await Promise.all([prisma?.$disconnect(), secondPrisma?.$disconnect()]);
  });

  it('allows only one of two independent clients to consume the same nonce', async () => {
    const id = randomUUID();
    ids.push(id);
    const now = new Date();
    await store.issue(id, new Date(now.getTime() + 60_000));

    const outcomes = await Promise.all([
      store.consume(id, now),
      secondStore.consume(id, now),
    ]);

    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(
      await prisma.oAuthStateNonce.findUnique({ where: { id } }),
    ).toBeNull();
    expect(await secondStore.consume(id, now)).toBe(false);
  });

  it('rejects a nonce at its expiration boundary from either client', async () => {
    const id = randomUUID();
    ids.push(id);
    const expiresAt = new Date(Date.now() + 60_000);
    await store.issue(id, expiresAt);

    expect(await store.consume(id, expiresAt)).toBe(false);
    expect(
      await secondStore.consume(id, new Date(expiresAt.getTime() + 1)),
    ).toBe(false);
  });
});
