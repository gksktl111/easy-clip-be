import {
  PaymentProvider as PrismaPaymentProvider,
  Prisma,
  SubscriptionPaymentStatus as PrismaSubscriptionPaymentStatus,
  SubscriptionPlan as PrismaSubscriptionPlan,
  SubscriptionStatus as PrismaSubscriptionStatus,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ActivateSubscriptionPaymentParams,
  MarkPaymentFailedParams,
  SubscriptionsRepository,
  UpdateSubscriptionParams,
} from '../domain/subscriptions.repository';
import { Subscription } from '../domain/subscription.types';

const subscriptionSelect = {
  id: true,
  workspaceId: true,
  plan: true,
  status: true,
  autoRenew: true,
  startedAt: true,
  currentPeriodEnd: true,
  nextBillingAt: true,
  provider: true,
  externalBillingKey: true,
  externalCustomerKey: true,
} satisfies Prisma.SubscriptionSelect;

@Injectable()
export class PrismaSubscriptionsRepository implements SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreatePersonalSubscription(userId: string): Promise<Subscription> {
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

      return tx.subscription.upsert({
        where: {
          workspaceId: workspace.id,
        },
        update: {},
        create: {
          workspaceId: workspace.id,
          plan: PrismaSubscriptionPlan.FREE,
          status: PrismaSubscriptionStatus.ACTIVE,
          autoRenew: false,
          currentPeriodEnd: null,
          nextBillingAt: null,
        },
        select: subscriptionSelect,
      });
    });
  }

  async updateSubscription(
    subscriptionId: string,
    params: UpdateSubscriptionParams,
  ): Promise<Subscription> {
    return this.prisma.subscription.update({
      where: {
        id: subscriptionId,
      },
      data: this.toSubscriptionUpdateData(params),
      select: subscriptionSelect,
    });
  }

  async activateByPayment(
    params: ActivateSubscriptionPaymentParams,
  ): Promise<Subscription> {
    return this.prisma.$transaction(async (tx) => {
      await tx.subscriptionPayment.upsert({
        where: {
          externalOrderId: params.externalOrderId,
        },
        update: {},
        create: this.toPaymentCreateData(params),
      });

      return tx.subscription.update({
        where: {
          id: params.subscriptionId,
        },
        data: {
          plan: PrismaSubscriptionPlan.PRO,
          status: PrismaSubscriptionStatus.ACTIVE,
          autoRenew: true,
          startedAt: params.startedAt,
          currentPeriodEnd: params.currentPeriodEnd,
          nextBillingAt: params.nextBillingAt,
          provider: params.provider,
          externalBillingKey: params.externalBillingKey,
          externalCustomerKey: params.externalCustomerKey,
        },
        select: subscriptionSelect,
      });
    });
  }

  async recordPaymentFailure(params: MarkPaymentFailedParams): Promise<void> {
    await this.prisma.subscriptionPayment.upsert({
      where: {
        externalOrderId: params.externalOrderId,
      },
      update: {},
      create: this.toPaymentCreateData(params),
    });
  }

  async findDueAutoRenewalSubscriptions(
    now: Date,
    limit: number,
  ): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: {
        plan: PrismaSubscriptionPlan.PRO,
        status: PrismaSubscriptionStatus.ACTIVE,
        autoRenew: true,
        externalBillingKey: {
          not: null,
        },
        externalCustomerKey: {
          not: null,
        },
        nextBillingAt: {
          lte: now,
        },
      },
      orderBy: {
        nextBillingAt: 'asc',
      },
      take: limit,
      select: subscriptionSelect,
    });
  }

  private toSubscriptionUpdateData(
    params: UpdateSubscriptionParams,
  ): Prisma.SubscriptionUpdateInput {
    return {
      ...(params.plan !== undefined ? { plan: params.plan } : {}),
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.autoRenew !== undefined
        ? { autoRenew: params.autoRenew }
        : {}),
      ...(params.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: params.currentPeriodEnd }
        : {}),
      ...(params.nextBillingAt !== undefined
        ? { nextBillingAt: params.nextBillingAt }
        : {}),
      ...(params.provider !== undefined ? { provider: params.provider } : {}),
      ...(params.externalBillingKey !== undefined
        ? { externalBillingKey: params.externalBillingKey }
        : {}),
      ...(params.externalCustomerKey !== undefined
        ? { externalCustomerKey: params.externalCustomerKey }
        : {}),
    };
  }

  private toPaymentCreateData(
    params: MarkPaymentFailedParams,
  ): Prisma.SubscriptionPaymentCreateInput {
    return {
      provider: params.provider as PrismaPaymentProvider,
      status: params.status as PrismaSubscriptionPaymentStatus,
      externalPaymentKey: params.externalPaymentKey ?? null,
      externalOrderId: params.externalOrderId,
      externalEventId: params.externalEventId ?? null,
      amount: params.amount,
      currency: params.currency,
      approvedAt: params.approvedAt ?? null,
      failedAt: params.failedAt ?? null,
      failureCode: params.failureCode ?? null,
      failureMessage: params.failureMessage ?? null,
      ...(params.rawData !== undefined
        ? { rawData: params.rawData as Prisma.InputJsonValue }
        : {}),
      subscription: {
        connect: {
          id: params.subscriptionId,
        },
      },
    };
  }
}
