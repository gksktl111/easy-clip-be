import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  UpdateWorkspaceSubscriptionParams,
  WorkspacesRepository,
} from '../domain/workspaces.repository';
import { WorkspaceSubscription } from '../domain/workspace.types';

@Injectable()
export class PrismaWorkspacesRepository implements WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreatePersonalWorkspaceSubscription(
    userId: string,
  ): Promise<WorkspaceSubscription> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.upsert({
        where: {
          ownerUserId: userId,
        },
        update: {},
        create: {
          name: 'Personal Workspace',
          ownerUserId: userId,
        },
        select: {
          id: true,
        },
      });

      const subscription = await tx.subscription.upsert({
        where: {
          workspaceId: workspace.id,
        },
        update: {},
        create: {
          workspaceId: workspace.id,
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          autoRenew: false,
          currentPeriodEnd: null,
        },
        select: {
          id: true,
          workspaceId: true,
          plan: true,
          status: true,
          autoRenew: true,
          currentPeriodEnd: true,
          startedAt: true,
        },
      });

      return subscription;
    });
  }

  async updateWorkspaceSubscription(
    subscriptionId: string,
    params: UpdateWorkspaceSubscriptionParams,
  ): Promise<WorkspaceSubscription> {
    return this.prisma.subscription.update({
      where: {
        id: subscriptionId,
      },
      data: {
        ...(params.plan !== undefined ? { plan: params.plan } : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...(params.autoRenew !== undefined
          ? { autoRenew: params.autoRenew }
          : {}),
        ...(params.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: params.currentPeriodEnd }
          : {}),
      },
      select: {
        id: true,
        workspaceId: true,
        plan: true,
        status: true,
        autoRenew: true,
        currentPeriodEnd: true,
        startedAt: true,
      },
    });
  }
}
