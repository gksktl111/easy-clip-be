import { randomUUID } from 'crypto';

export function createExternalCustomerKey(userId: string): string {
  return `easyclip_${userId}_${randomUUID()}`;
}

export function createSubscriptionOrderId(subscriptionId: string): string {
  return `sub_${subscriptionId}_${Date.now()}_${randomUUID()}`;
}
