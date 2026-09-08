import type { SubscriptionsRepository } from '../domain/subscriptions.repository';

export const createSubscriptionsRepositoryMock =
  (): jest.Mocked<SubscriptionsRepository> => ({
    getOrCreatePersonalSubscription: jest.fn(),
    findBillingMailRecipientByUserId: jest.fn(),
    findBillingMailRecipientBySubscriptionId: jest.fn(),
    updateSubscription: jest.fn(),
    cancelAutoRenewal: jest.fn().mockResolvedValue(null),
    resumeAutoRenewal: jest.fn().mockResolvedValue(null),
    hasPendingAutoRenewalPayment: jest.fn().mockResolvedValue(false),
    expireSubscriptionIfUnchanged: jest.fn(),
    activateByPayment: jest.fn(),
    recordPaymentFailure: jest.fn(),
    claimAutoRenewalPayment: jest.fn(),
    findDueAutoRenewalSubscriptions: jest.fn().mockResolvedValue([]),
    findAutoRenewalPaymentsToReconcile: jest.fn().mockResolvedValue([]),
    claimAutoRenewalReconciliation: jest.fn(),
    deferAutoRenewalReconciliation: jest.fn(),
    completeAutoRenewalPayment: jest.fn(),
  });
