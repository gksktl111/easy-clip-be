import { InitialPaymentOutput } from '../dtos/initial-payment-output.dto';
import { initialPaymentOutput } from '../helpers/initial-payment-response.helper';
import { Inject, Injectable } from '@nestjs/common';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import { SubscriptionsError } from '../errors/subscriptions.error';

@Injectable()
export class GetInitialPaymentUseCase {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly repo: SubscriptionsRepository,
  ) {}
  async execute(
    userId: string,
    idempotencyKey: string,
  ): Promise<InitialPaymentOutput> {
    const subscription =
      await this.repo.getOrCreatePersonalSubscription(userId);
    const attempt = await this.repo.findInitialPayment(
      subscription.id,
      idempotencyKey,
    );
    if (!attempt)
      throw new SubscriptionsError(
        'NOT_FOUND',
        '결제 시도를 찾을 수 없습니다.',
      );
    return initialPaymentOutput(attempt);
  }
}
