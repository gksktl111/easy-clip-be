import { ProMonthlyPrice } from '../dtos/subscription-price-output.dto';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { SubscriptionsError } from '../errors/subscriptions.error';

export function resolveProMonthlyPrice(config: ConfigService): ProMonthlyPrice {
  const raw = config.get<string>('PRO_MONTHLY_AMOUNT');
  const amount =
    typeof raw === 'string' && /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
  const currency = config.get<string>('TOSS_PAYMENTS_CURRENCY', 'KRW');
  if (
    !Number.isSafeInteger(amount) ||
    amount > 2147483647 ||
    currency !== 'KRW'
  ) {
    throw new SubscriptionsError(
      'INTERNAL',
      '공개 및 청구 가격 설정이 필요합니다.',
    );
  }
  return {
    plan: 'PRO',
    amount,
    currency,
    interval: 'MONTH',
    intervalCount: 1,
    priceVersion: createHash('sha256')
      .update(`PRO:${amount}:${currency}:MONTH:1`)
      .digest('hex'),
  };
}
