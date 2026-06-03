import { Inject, Injectable } from '@nestjs/common';
import { WORKSPACES_REPOSITORY } from '../../domain/workspaces.repository';
import type { WorkspacesRepository } from '../../domain/workspaces.repository';
import {
  MySubscriptionResponse,
  UpdateMySubscriptionInput,
  WorkspaceSubscription,
  WorkspaceSubscriptionAction,
  WorkspaceSubscriptionPlan,
  WorkspaceSubscriptionStatus,
} from '../../domain/workspace.types';
import { normalizeExpiredSubscription } from '../policies/subscription-expiration.policy';
import { WorkspacesError } from '../errors/workspaces.error';

const DEFAULT_PRO_BILLING_DAYS = 30;

@Injectable()
export class UpdateMySubscriptionUseCase {
  constructor(
    @Inject(WORKSPACES_REPOSITORY)
    private readonly workspacesRepository: WorkspacesRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateMySubscriptionInput,
  ): Promise<MySubscriptionResponse> {
    this.validateInput(input);

    const currentSubscription =
      await this.workspacesRepository.getOrCreatePersonalWorkspaceSubscription(
        userId,
      );

    const normalizedSubscription = await normalizeExpiredSubscription(
      this.workspacesRepository,
      currentSubscription,
    );

    switch (input.type) {
      case WorkspaceSubscriptionAction.CHANGE_PLAN:
        return this.changePlan(normalizedSubscription, input.plan!);
      case WorkspaceSubscriptionAction.CANCEL:
        return this.cancel(normalizedSubscription);
      case WorkspaceSubscriptionAction.RESUME:
        return this.resume(normalizedSubscription);
      default:
        throw new WorkspacesError(
          'BAD_REQUEST',
          '지원하지 않는 요청 타입입니다.',
        );
    }
  }

  private validateInput(input: UpdateMySubscriptionInput) {
    if (input.type === WorkspaceSubscriptionAction.CHANGE_PLAN) {
      if (!input.plan) {
        throw new WorkspacesError(
          'BAD_REQUEST',
          'CHANGE_PLAN 요청에는 plan 값이 필요합니다.',
        );
      }

      return;
    }

    if (input.plan !== undefined) {
      throw new WorkspacesError(
        'BAD_REQUEST',
        'plan 값은 CHANGE_PLAN 요청에서만 사용할 수 있습니다.',
      );
    }
  }

  private async changePlan(
    subscription: WorkspaceSubscription,
    plan: WorkspaceSubscriptionPlan,
  ): Promise<MySubscriptionResponse> {
    if (plan === WorkspaceSubscriptionPlan.FREE) {
      if (
        subscription.plan === WorkspaceSubscriptionPlan.FREE &&
        subscription.status === WorkspaceSubscriptionStatus.ACTIVE &&
        !subscription.autoRenew
      ) {
        throw new WorkspacesError('CONFLICT', '이미 FREE 플랜입니다.');
      }

      const updated =
        await this.workspacesRepository.updateWorkspaceSubscription(
          subscription.id,
          {
            plan: WorkspaceSubscriptionPlan.FREE,
            status: WorkspaceSubscriptionStatus.ACTIVE,
            autoRenew: false,
            currentPeriodEnd: null,
          },
        );

      return this.toResponse(updated);
    }

    if (
      subscription.plan === WorkspaceSubscriptionPlan.PRO &&
      subscription.status === WorkspaceSubscriptionStatus.ACTIVE &&
      subscription.autoRenew
    ) {
      throw new WorkspacesError('CONFLICT', '이미 PRO 플랜입니다.');
    }

    const updated = await this.workspacesRepository.updateWorkspaceSubscription(
      subscription.id,
      {
        plan: WorkspaceSubscriptionPlan.PRO,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: this.resolveCurrentPeriodEnd(
          subscription.currentPeriodEnd,
        ),
      },
    );

    return this.toResponse(updated);
  }

  private async cancel(
    subscription: WorkspaceSubscription,
  ): Promise<MySubscriptionResponse> {
    if (
      subscription.plan !== WorkspaceSubscriptionPlan.PRO ||
      subscription.status !== WorkspaceSubscriptionStatus.ACTIVE
    ) {
      throw new WorkspacesError(
        'CONFLICT',
        'CANCEL은 PRO ACTIVE 상태에서만 가능합니다.',
      );
    }

    const updated = await this.workspacesRepository.updateWorkspaceSubscription(
      subscription.id,
      {
        status: WorkspaceSubscriptionStatus.CANCELED,
        autoRenew: false,
        currentPeriodEnd: this.resolveCurrentPeriodEnd(
          subscription.currentPeriodEnd,
        ),
      },
    );

    return this.toResponse(updated);
  }

  private async resume(
    subscription: WorkspaceSubscription,
  ): Promise<MySubscriptionResponse> {
    if (
      subscription.plan !== WorkspaceSubscriptionPlan.PRO ||
      subscription.status !== WorkspaceSubscriptionStatus.CANCELED
    ) {
      throw new WorkspacesError(
        'CONFLICT',
        'RESUME은 PRO CANCELED 상태에서만 가능합니다.',
      );
    }

    const updated = await this.workspacesRepository.updateWorkspaceSubscription(
      subscription.id,
      {
        status: WorkspaceSubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: this.resolveCurrentPeriodEnd(
          subscription.currentPeriodEnd,
        ),
      },
    );

    return this.toResponse(updated);
  }

  private resolveCurrentPeriodEnd(currentPeriodEnd: Date | null): Date {
    if (currentPeriodEnd && currentPeriodEnd > new Date()) {
      return currentPeriodEnd;
    }

    const nextPeriodEnd = new Date();
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + DEFAULT_PRO_BILLING_DAYS);

    return nextPeriodEnd;
  }

  private toResponse(
    subscription: WorkspaceSubscription,
  ): MySubscriptionResponse {
    return {
      plan: subscription.plan,
      status: subscription.status,
      autoRenew: subscription.autoRenew,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }
}
