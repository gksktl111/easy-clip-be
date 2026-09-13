import { ConfigService } from '@nestjs/config';
import { GetSubscriptionPriceUseCase } from './get-subscription-price.usecase';
import { CreateBillingAuthRequestUseCase } from './create-billing-auth-request.usecase';
import { createSubscriptionsRepositoryMock } from '../../test-support/create-subscriptions-repository-mock';

const config = (values: Record<string, string> = {}) =>
  new ConfigService({
    TOSS_PAYMENTS_CURRENCY: 'KRW',
    TOSS_PAYMENTS_CLIENT_KEY: 'test-client',
    TOSS_PAYMENTS_BILLING_SUCCESS_URL: 'https://example.test/success',
    TOSS_PAYMENTS_BILLING_FAIL_URL: 'https://example.test/fail',
    ...values,
  });

describe('Public subscription price contract', () => {
  it.each(['', '0', '-1', '4.5', 'invalid', '2147483648'])(
    'rejects an unconfigured or invalid amount %s without a fallback',
    (amount) => {
      expect(() =>
        new GetSubscriptionPriceUseCase(
          config({ PRO_MONTHLY_AMOUNT: amount }),
        ).execute(),
      ).toThrow('공개 및 청구 가격 설정이 필요합니다.');
    },
  );

  it('changes the opaque version when the configured amount changes', () => {
    const oldPrice = new GetSubscriptionPriceUseCase(
      config({ PRO_MONTHLY_AMOUNT: '1000' }),
    ).execute();
    const price = new GetSubscriptionPriceUseCase(
      config({ PRO_MONTHLY_AMOUNT: '2000' }),
    ).execute();
    expect(price).toMatchObject({
      plan: 'PRO',
      amount: 2000,
      currency: 'KRW',
      interval: 'MONTH',
      intervalCount: 1,
    });
    expect(price.priceVersion).not.toBe(oldPrice.priceVersion);
  });

  it('rejects unsupported currency rather than publish a currency the gateway cannot charge', () => {
    expect(() =>
      new GetSubscriptionPriceUseCase(
        config({ PRO_MONTHLY_AMOUNT: '1000', TOSS_PAYMENTS_CURRENCY: 'USD' }),
      ).execute(),
    ).toThrow();
  });

  it('returns the same quote for the public page and billing authorization', async () => {
    const settings = config({ PRO_MONTHLY_AMOUNT: '1000' });
    const repository = createSubscriptionsRepositoryMock();
    repository.getOrCreatePersonalSubscription.mockResolvedValue({
      id: 'subscription',
      externalCustomerKey: 'customer',
    } as never);
    const result = await new CreateBillingAuthRequestUseCase(
      repository,
      settings,
    ).execute('user');
    expect(result.price).toEqual(
      new GetSubscriptionPriceUseCase(settings).execute(),
    );
  });

  it('does not create customer records when no selling price is configured', async () => {
    const repository = createSubscriptionsRepositoryMock();
    await expect(
      new CreateBillingAuthRequestUseCase(
        repository,
        config({ PRO_MONTHLY_AMOUNT: '' }),
      ).execute('user'),
    ).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(repository.getOrCreatePersonalSubscription.mock.calls).toHaveLength(
      0,
    );
  });
});
