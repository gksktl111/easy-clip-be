import { randomUUID } from 'crypto';

export function createExternalCustomerKey(userId: string): string {
  return `easyclip_${userId}_${randomUUID()}`;
}

export function createSubscriptionOrderId(subscriptionId: string): string {
  return `sub_${subscriptionId}_${Date.now()}_${randomUUID()}`;
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
