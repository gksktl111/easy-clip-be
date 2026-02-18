/* eslint-disable @typescript-eslint/unbound-method */
import { UpdateMySubscriptionUseCase } from './update-my-subscription.usecase';
import { WorkspacesRepository } from '../../domain/workspaces.repository';
import {
  WorkspaceSubscription,
  WorkspaceSubscriptionAction,
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

describe('UpdateMySubscriptionUseCase', () => {
  it('CHANGE_PLAN 요청에 plan이 없으면 BAD_REQUEST를 반환한다', async () => {
    const repo = createRepository();
    const usecase = new UpdateMySubscriptionUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        type: WorkspaceSubscriptionAction.CHANGE_PLAN,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('CANCEL 요청에 plan을 보내면 BAD_REQUEST를 반환한다', async () => {
    const repo = createRepository();
    const usecase = new UpdateMySubscriptionUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        type: WorkspaceSubscriptionAction.CANCEL,
        plan: WorkspaceSubscriptionPlan.FREE,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('CHANGE_PLAN PRO는 FREE에서 PRO_RENEWING 상태로 변경한다', async () => {
    const repo = createRepository();
    const updatedPeriodEnd = new Date('2099-01-01T00:00:00.000Z');

    repo.getOrCreatePersonalWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: false,
      }),
    );

    repo.updateWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: updatedPeriodEnd,
      }),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo);
    const result = await usecase.execute('user-id', {
      type: WorkspaceSubscriptionAction.CHANGE_PLAN,
      plan: WorkspaceSubscriptionPlan.PRO,
    });

    const updateCall = repo.updateWorkspaceSubscription.mock.calls[0];
    expect(updateCall?.[0]).toBe('subscription-id');
    expect(updateCall?.[1]).toMatchObject({
      plan: WorkspaceSubscriptionPlan.PRO,
      status: WorkspaceSubscriptionStatus.ACTIVE,
      autoRenew: true,
    });
    expect(updateCall?.[1].currentPeriodEnd).toBeInstanceOf(Date);

    expect(result).toEqual({
      plan: WorkspaceSubscriptionPlan.PRO,
      status: WorkspaceSubscriptionStatus.ACTIVE,
      autoRenew: true,
      currentPeriodEnd: updatedPeriodEnd,
    });
  });

  it('CHANGE_PLAN FREE는 FREE ACTIVE 상태로 변경한다', async () => {
    const repo = createRepository();

    repo.getOrCreatePersonalWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      }),
    );

    repo.updateWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: false,
        currentPeriodEnd: null,
      }),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo);
    const result = await usecase.execute('user-id', {
      type: WorkspaceSubscriptionAction.CHANGE_PLAN,
      plan: WorkspaceSubscriptionPlan.FREE,
    });

    expect(repo.updateWorkspaceSubscription).toHaveBeenCalledWith(
      'subscription-id',
      {
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: false,
        currentPeriodEnd: null,
      },
    );

    expect(result).toEqual({
      plan: WorkspaceSubscriptionPlan.FREE,
      status: WorkspaceSubscriptionStatus.ACTIVE,
      autoRenew: false,
      currentPeriodEnd: null,
    });
  });

  it('CANCEL은 PRO ACTIVE 상태에서만 수행된다', async () => {
    const repo = createRepository();

    repo.getOrCreatePersonalWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      }),
    );

    repo.updateWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      }),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo);
    const result = await usecase.execute('user-id', {
      type: WorkspaceSubscriptionAction.CANCEL,
    });

    expect(repo.updateWorkspaceSubscription).toHaveBeenCalledWith(
      'subscription-id',
      {
        status: WorkspaceSubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      },
    );

    expect(result).toEqual({
      plan: WorkspaceSubscriptionPlan.PRO,
      status: WorkspaceSubscriptionStatus.CANCELED,
      autoRenew: false,
      currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    });
  });

  it('RESUME은 PRO CANCELED 상태에서만 수행된다', async () => {
    const repo = createRepository();

    repo.getOrCreatePersonalWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      }),
    );

    repo.updateWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      }),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo);
    const result = await usecase.execute('user-id', {
      type: WorkspaceSubscriptionAction.RESUME,
    });

    expect(repo.updateWorkspaceSubscription).toHaveBeenCalledWith(
      'subscription-id',
      {
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      },
    );

    expect(result).toEqual({
      plan: WorkspaceSubscriptionPlan.PRO,
      status: WorkspaceSubscriptionStatus.ACTIVE,
      autoRenew: true,
      currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    });
  });

  it('FREE 상태에서 CANCEL을 요청하면 CONFLICT를 반환한다', async () => {
    const repo = createRepository();
    repo.getOrCreatePersonalWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: false,
      }),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        type: WorkspaceSubscriptionAction.CANCEL,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('만료일이 지난 CANCELED 상태에서 RESUME 요청 시 CONFLICT를 반환한다', async () => {
    const repo = createRepository();

    repo.getOrCreatePersonalWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      }),
    );

    repo.updateWorkspaceSubscription.mockResolvedValue(
      createSubscription({
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.EXPIRED,
        autoRenew: false,
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      }),
    );

    const usecase = new UpdateMySubscriptionUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        type: WorkspaceSubscriptionAction.RESUME,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(repo.updateWorkspaceSubscription).toHaveBeenCalledWith(
      'subscription-id',
      {
        plan: WorkspaceSubscriptionPlan.FREE,
        status: WorkspaceSubscriptionStatus.EXPIRED,
        autoRenew: false,
      },
    );
  });
});
