import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SUBSCRIPTIONS_REPOSITORY } from '../../domain/subscriptions.repository';
import type { SubscriptionsRepository } from '../../domain/subscriptions.repository';
import { PaymentProvider } from '../../domain/subscription.types';
import { BillingAuthRequestOutput } from '../dtos/billing-auth-output.dto';
import { SubscriptionsError } from '../errors/subscriptions.error';
import { createExternalCustomerKey } from '../helpers/customer-key.helper';

@Injectable()
export class CreateBillingAuthRequestUseCase {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY)
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(userId: string): Promise<BillingAuthRequestOutput> {
    const clientKey = this.configService.get<string>(
      'TOSS_PAYMENTS_CLIENT_KEY',
    );
    const successUrl = this.configService.get<string>(
      'TOSS_PAYMENTS_BILLING_SUCCESS_URL',
    );
    const failUrl = this.configService.get<string>(
      'TOSS_PAYMENTS_BILLING_FAIL_URL',
    );

    const missingConfigKeys = [
      ['TOSS_PAYMENTS_CLIENT_KEY', clientKey],
      ['TOSS_PAYMENTS_BILLING_SUCCESS_URL', successUrl],
      ['TOSS_PAYMENTS_BILLING_FAIL_URL', failUrl],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingConfigKeys.length > 0) {
      throw new SubscriptionsError(
        'INTERNAL',
        `토스페이먼츠 자동결제 설정이 필요합니다: ${missingConfigKeys.join(
          ', ',
        )}`,
      );
    }

    const billingAuthConfig = {
      clientKey: clientKey!,
      successUrl: successUrl!,
      failUrl: failUrl!,
    };

    const subscription =
      await this.subscriptionsRepository.getOrCreatePersonalSubscription(
        userId,
      );
    const customerKey =
      subscription.externalCustomerKey ?? createExternalCustomerKey(userId);

    if (!subscription.externalCustomerKey) {
      await this.subscriptionsRepository.updateSubscription(subscription.id, {
        provider: PaymentProvider.TOSS_PAYMENTS,
        externalCustomerKey: customerKey,
      });
    }

    return {
      clientKey: billingAuthConfig.clientKey,
      customerKey,
      method: 'CARD',
      successUrl: billingAuthConfig.successUrl,
      failUrl: billingAuthConfig.failUrl,
    };
  }
}
