import type { SubscriptionsRepository } from '../domain/subscriptions.repository';

export const createSubscriptionsRepositoryMock =
  (): jest.Mocked<SubscriptionsRepository> => ({
    getOrCreatePersonalSubscription: jest.fn(),
    findBillingMailRecipientByUserId: jest.fn(),
    findBillingMailRecipientBySubscriptionId: jest.fn(),
    updateSubscription: jest.fn(),
    activateByPayment: jest.fn(),
    recordPaymentFailure: jest.fn(),
    claimAutoRenewalPayment: jest.fn(),
    findDueAutoRenewalSubscriptions: jest.fn(),
  });
