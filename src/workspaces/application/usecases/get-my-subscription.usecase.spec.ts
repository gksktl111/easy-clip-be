/* eslint-disable @typescript-eslint/unbound-method */
import { GetMySubscriptionUseCase } from './get-my-subscription.usecase';
import { WorkspacesRepository } from '../../domain/workspaces.repository';
import {
  WorkspaceSubscription,
  WorkspaceSubscriptionPlan,
  WorkspaceSubscriptionStatus,
} from '../../domain/workspace.types';

const createRepository = (): jest.Mocked<WorkspacesRepository> => ({
  getOrCreatePersonalWorkspaceSubscription: jest.fn(),
  updateWorkspaceSubscription: jest.fn(),
});

const createSubscription = (
  overrides: Partial<WorkspaceSubscription> = {},
): WorkspaceSubscription => ({
  id: 'subscription-id',
  workspaceId: 'workspace-id',
  plan: WorkspaceSubscriptionPlan.FREE,
  status: WorkspaceSubscriptionStatus.ACTIVE,
  autoRenew: false,
  currentPeriodEnd: null,
  startedAt: new Date('2026-02-01T00:00:00.000Z'),
  ...overrides,
});

describe('GetMySubscriptionUseCase', () => {
  it('현재 구독 상태를 반환한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceSubscription.mockResolvedValue(
      createSubscription(),
    );

    const usecase = new GetMySubscriptionUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.updateWorkspaceSubscription).not.toHaveBeenCalled();
    expect(result).toEqual({
      plan: WorkspaceSubscriptionPlan.FREE,
      status: WorkspaceSubscriptionStatus.ACTIVE,
      autoRenew: false,
      currentPeriodEnd: null,
    });
  });

  it('CANCELED 구독이 만료일을 지났으면 EXPIRED로 전환해 반환한다', async () => {
    const repo = createRepository();
    const pastPeriodEnd = new Date('2020-01-01T00:00:00.000Z');

    repo.getOrCreatePersonalWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd: pastPeriodEnd,
      }),
    );

    repo.updateWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.EXPIRED,
        autoRenew: false,
        currentPeriodEnd: pastPeriodEnd,
      }),
    );

    const usecase = new GetMySubscriptionUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.updateWorkspaceSubscription).toHaveBeenCalledWith(
      'subscription-id',
      {
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.EXPIRED,
        autoRenew: false,
      },
    );

    expect(result).toEqual({
      plan: WorkspaceSubscriptionPlan.FREE,
      status: WorkspaceSubscriptionStatus.EXPIRED,
      autoRenew: false,
      currentPeriodEnd: pastPeriodEnd,
    });
  });
});
