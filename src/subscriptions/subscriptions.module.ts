import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { SUBSCRIPTIONS_REPOSITORY } from './domain/subscriptions.repository';
import { BILLING_PAYMENT_GATEWAY } from './application/ports/billing-payment.gateway';
import { ConfirmBillingAuthUseCase } from './application/usecases/confirm-billing-auth.usecase';
import { CreateBillingAuthRequestUseCase } from './application/usecases/create-billing-auth-request.usecase';
import { GetMySubscriptionUseCase } from './application/usecases/get-my-subscription.usecase';
import { ProcessDueAutoRenewalsUseCase } from './application/usecases/process-due-auto-renewals.usecase';
import { UpdateMySubscriptionUseCase } from './application/usecases/update-my-subscription.usecase';
import { PrismaSubscriptionsRepository } from './infrastructure/prisma-subscriptions.repository';
import { TossPaymentsBillingGateway } from './infrastructure/toss-payments-billing.gateway';
import { SubscriptionsController } from './presentation/subscriptions.controller';

@Module({
  controllers: [SubscriptionsController],
  providers: [
    {
      provide: SUBSCRIPTIONS_REPOSITORY,
      useClass: PrismaSubscriptionsRepository,
    },
    {
      provide: BILLING_PAYMENT_GATEWAY,
      useClass: TossPaymentsBillingGateway,
    },
    GetMySubscriptionUseCase,
    UpdateMySubscriptionUseCase,
    CreateBillingAuthRequestUseCase,
    ConfirmBillingAuthUseCase,
    ProcessDueAutoRenewalsUseCase,
    JwtAccessGuard,
  ],
})
export class SubscriptionsModule {}
