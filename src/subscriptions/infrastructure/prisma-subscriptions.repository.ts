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
  AutoRenewalPayment,
  BillingMailRecipient,
  ClaimAutoRenewalPaymentParams,
  CompleteAutoRenewalPaymentParams,
  DeferAutoRenewalReconciliationParams,
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

const renewalPaymentSelect = {
  id: true,
  subscriptionId: true,
  externalOrderId: true,
  amount: true,
  currency: true,
  renewalDueAt: true,
  renewalPeriodEnd: true,
  reconciliationAttempts: true,
} satisfies Prisma.SubscriptionPaymentSelect;

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

  async expireSubscriptionIfUnchanged(
    subscriptionId: string,
    expectedPeriodEnd: Date,
  ): Promise<Subscription> {
    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          id: subscriptionId,
          plan: PrismaSubscriptionPlan.PRO,
          autoRenew: false,
          currentPeriodEnd: expectedPeriodEnd,
        },
        data: {
          plan: PrismaSubscriptionPlan.FREE,
          status: PrismaSubscriptionStatus.EXPIRED,
          nextBillingAt: null,
        },
      });
      return tx.subscription.findUniqueOrThrow({
        where: { id: subscriptionId },
        select: subscriptionSelect,
      });
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
    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionPayment.upsert({
        where: { externalOrderId: params.externalOrderId },
        update: {},
        create: this.toPaymentCreateData(params),
      });
      // 지연된 실패 응답이 이미 대사·반영된 성공 결제를 덮어쓰지 않는다.
      await tx.subscriptionPayment.updateMany({
        where: {
          externalOrderId: params.externalOrderId,
          subscriptionId: params.subscriptionId,
          status: PrismaSubscriptionPaymentStatus.PENDING,
        },
        data: {
          ...this.toPaymentUpdateData(params),
          reconciliationNextAt: null,
        },
      });
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
          renewalDueAt: params.renewalDueAt,
          renewalPeriodEnd: params.renewalPeriodEnd,
          reconciliationNextAt: params.reconciliationNextAt,
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
        // 미확정 주문은 구독 상태와 별도의 대사 큐에서 처리한다.
        // 기간이 변경돼도 결과 확인 전에 새 주문을 과금하지 않는다.
        payments: { none: { status: PrismaSubscriptionPaymentStatus.PENDING } },
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

  async findAutoRenewalPaymentsToReconcile(
    now: Date,
    limit: number,
  ): Promise<AutoRenewalPayment[]> {
    return this.prisma.subscriptionPayment.findMany({
      where: {
        provider: PrismaPaymentProvider.TOSS_PAYMENTS,
        status: PrismaSubscriptionPaymentStatus.PENDING,
        reconciliationNextAt: { lte: now },
        manualReviewAt: null,
      },
      orderBy: [{ reconciliationNextAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: renewalPaymentSelect,
    });
  }

  async claimAutoRenewalReconciliation(
    paymentId: string,
    now: Date,
    leaseUntil: Date,
  ): Promise<AutoRenewalPayment | null> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.subscriptionPayment.updateMany({
        where: {
          id: paymentId,
          status: PrismaSubscriptionPaymentStatus.PENDING,
          reconciliationNextAt: { lte: now },
          manualReviewAt: null,
        },
        data: {
          reconciliationNextAt: leaseUntil,
          reconciliationAttempts: { increment: 1 },
        },
      });
      return claimed.count === 1
        ? tx.subscriptionPayment.findUniqueOrThrow({
            where: { id: paymentId },
            select: renewalPaymentSelect,
          })
        : null;
    });
  }

  async deferAutoRenewalReconciliation(
    params: DeferAutoRenewalReconciliationParams,
  ): Promise<void> {
    await this.prisma.subscriptionPayment.updateMany({
      where: {
        id: params.paymentId,
        status: PrismaSubscriptionPaymentStatus.PENDING,
        reconciliationAttempts: params.attempt,
      },
      data: {
        reconciliationNextAt: params.nextAttemptAt,
        reconciliationError: params.error,
        manualReviewAt: params.manualReviewAt ?? null,
      },
    });
  }

  async completeAutoRenewalPayment(
    params: CompleteAutoRenewalPaymentParams,
  ): Promise<Subscription | null> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.findUniqueOrThrow({
        where: { externalOrderId: params.externalOrderId },
        select: renewalPaymentSelect,
      });
      const completed = await tx.subscriptionPayment.updateMany({
        where: {
          id: payment.id,
          status: PrismaSubscriptionPaymentStatus.PENDING,
          provider: PrismaPaymentProvider.TOSS_PAYMENTS,
          renewalDueAt: { not: null },
          amount: params.amount,
          currency: params.currency,
        },
        data: {
          status: PrismaSubscriptionPaymentStatus.DONE,
          externalPaymentKey: params.externalPaymentKey,
          approvedAt: params.approvedAt,
          rawData: params.rawData as Prisma.InputJsonValue,
          reconciliationNextAt: null,
          reconciliationError: null,
          manualReviewAt: null,
          failedAt: null,
          failureCode: null,
          failureMessage: null,
        },
      });
      if (completed.count === 0) return null;

      // 서로 다른 주문의 반영도 기간을 되돌리지 않도록 최신 구독을 잠근다.
      // 외부 조회·과금은 이 트랜잭션 밖에서 완료된다.
      await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "id" = ${payment.subscriptionId} FOR UPDATE`;
      const subscription = await tx.subscription.findUniqueOrThrow({
        where: { id: payment.subscriptionId },
        select: subscriptionSelect,
      });
      const periodEnd =
        subscription.currentPeriodEnd &&
        subscription.currentPeriodEnd > params.currentPeriodEnd
          ? subscription.currentPeriodEnd
          : params.currentPeriodEnd;
      return tx.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: PrismaSubscriptionPlan.PRO,
          status: subscription.autoRenew
            ? PrismaSubscriptionStatus.ACTIVE
            : PrismaSubscriptionStatus.CANCELED,
          currentPeriodEnd: periodEnd,
          nextBillingAt: subscription.autoRenew ? periodEnd : null,
        },
        select: subscriptionSelect,
      });
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
  ): Prisma.SubscriptionPaymentUpdateManyMutationInput {
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
    };
  }
}
