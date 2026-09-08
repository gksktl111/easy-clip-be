/* eslint-disable @typescript-eslint/unbound-method */
import { GetMySubscriptionUseCase } from './get-my-subscription.usecase';
import { createSubscriptionsRepositoryMock } from '../../test-support/create-subscriptions-repository-mock';
import type { Subscription } from '../../domain/subscription.types';

const expired: Subscription = {
  id: 'subscription-id',
  workspaceId: 'workspace-id',
  plan: 'PRO',
  status: 'CANCELED',
  autoRenew: false,
  startedAt: new Date('2026-01-01'),
  currentPeriodEnd: new Date('2026-02-01'),
  nextBillingAt: null,
  provider: 'TOSS_PAYMENTS',
  externalBillingKey: 'billing-key',
  externalCustomerKey: 'customer-key',
};

describe('GetMySubscriptionUseCase', () => {
  it('조회 후 결제 복구가 완료되면 오래된 만료 정보로 Pro를 덮어쓰지 않는다', async () => {
    const repo = createSubscriptionsRepositoryMock();
    repo.getOrCreatePersonalSubscription.mockResolvedValue(expired);
    const restoredEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    repo.expireSubscriptionIfUnchanged.mockResolvedValue({
      ...expired,
      currentPeriodEnd: restoredEnd,
    });

    const result = await new GetMySubscriptionUseCase(repo).execute('user-id');

    expect(repo.expireSubscriptionIfUnchanged).toHaveBeenCalledWith(
      expired.id,
      expired.currentPeriodEnd,
    );
    expect(repo.updateSubscription).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      plan: 'PRO',
      currentPeriodEnd: restoredEnd,
      autoRenew: false,
    });
  });

  it('기간이 변경되지 않은 만료 구독은 Free 결과를 반환한다', async () => {
    const repo = createSubscriptionsRepositoryMock();
    repo.getOrCreatePersonalSubscription.mockResolvedValue(expired);
    repo.expireSubscriptionIfUnchanged.mockResolvedValue({
      ...expired,
      plan: 'FREE',
      status: 'EXPIRED',
    });

    expect(
      await new GetMySubscriptionUseCase(repo).execute('user-id'),
    ).toMatchObject({ plan: 'FREE', status: 'EXPIRED' });
  });
});
