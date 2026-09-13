import { createHash, randomUUID } from 'crypto';

export function createExternalCustomerKey(userId: string): string {
  return `easyclip_${userId}_${randomUUID()}`;
}

export function createSubscriptionOrderId(subscriptionId: string): string {
  const subscriptionKey = createHash('sha256')
    .update(subscriptionId)
    .digest('hex')
    .slice(0, 12);
  // Keep new orders within Toss's 64-character limit regardless of ID length.
  return `sub_${subscriptionKey}_${randomUUID().replace(/-/g, '')}`;
}

export function createAutoRenewalSubscriptionOrderId(
  subscriptionId: string,
  nextBillingAt: Date,
): string {
  const billingPeriodKey = nextBillingAt
    .toISOString()
    .replace(/\D/g, '')
    .slice(0, 14);

  return `sub_${subscriptionId}_${billingPeriodKey}`;
}
