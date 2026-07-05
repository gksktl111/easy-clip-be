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
  BillingMailRecipient,
  ClaimAutoRenewalPaymentParams,
  MarkPaymentFailedParams,
  SubscriptionsRepository,
  UpdateSubscriptionParams,
} from '../domain/subscriptions.repository';
import {
  Subscription,
  SubscriptionPaymentStatus,
} from '../domain/subscription.types';

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

  async findBillingMailRecipientByUserId(
    userId: string,
  ): Promise<BillingMailRecipient | null> {
    return this.findBillingMailRecipientByOwnerUserId(userId);
  }

  async findBillingMailRecipientBySubscriptionId(
    subscriptionId: string,
  ): Promise<BillingMailRecipient | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: {
        id: subscriptionId,
      },
      select: {
        workspace: {
          select: {
            ownerUserId: true,
          },
        },
      },
    });

    if (!subscription) {
      return null;
    }

    return this.findBillingMailRecipientByOwnerUserId(
      subscription.workspace.ownerUserId,
    );
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
        update: this.toPaymentUpdateData(params),
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
      update: this.toPaymentUpdateData(params),
      create: this.toPaymentCreateData(params),
    });
  }

  async claimAutoRenewalPayment(
    params: ClaimAutoRenewalPaymentParams,
  ): Promise<boolean> {
    try {
      await this.prisma.subscriptionPayment.create({
        data: {
          provider: params.provider as PrismaPaymentProvider,
          status:
            SubscriptionPaymentStatus.PENDING as PrismaSubscriptionPaymentStatus,
          externalOrderId: params.externalOrderId,
          amount: params.amount,
          currency: params.currency,
          subscription: {
            connect: {
              id: params.subscriptionId,
            },
          },
        },
      });

      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }

      throw error;
    }
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

  private async findBillingMailRecipientByOwnerUserId(
    userId: string,
  ): Promise<BillingMailRecipient | null> {
    const account = await this.prisma.authAccount.findFirst({
      where: {
        userId,
        email: {
          not: '',
        },
      },
      // AuthAccount에는 primary 플래그가 없으므로 id 기준으로 고정해 대표 이메일 선택을 재현 가능하게 만든다.
      orderBy: {
        id: 'asc',
      },
      select: {
        email: true,
      },
    });

    return account ? { email: account.email } : null;
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

  private toPaymentUpdateData(
    params: MarkPaymentFailedParams,
  ): Prisma.SubscriptionPaymentUpdateInput {
    return {
      provider: params.provider as PrismaPaymentProvider,
      status: params.status as PrismaSubscriptionPaymentStatus,
      externalPaymentKey: params.externalPaymentKey ?? null,
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
