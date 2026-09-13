import { ProcessSubscriptionPaymentsUseCase } from './process-subscription-payments.usecase';
import { ProcessDueAutoRenewalsUseCase } from './process-due-auto-renewals.usecase';
import { ReconcileInitialPaymentsUseCase } from './reconcile-initial-payments.usecase';

describe('ProcessSubscriptionPaymentsUseCase', () => {
  const input = { accessPolicy: { enabled: false } };

  it('never reconciles initial payments when the existing batch authorization rejects', async () => {
    const renewals = {
      execute: jest.fn().mockRejectedValue(new Error('forbidden')),
    };
    const initial = { executeBatch: jest.fn() };
    const usecase = new ProcessSubscriptionPaymentsUseCase(
      renewals as unknown as ProcessDueAutoRenewalsUseCase,
      initial as unknown as ReconcileInitialPaymentsUseCase,
    );
    await expect(usecase.execute(input)).rejects.toThrow('forbidden');
    expect(initial.executeBatch).not.toHaveBeenCalled();
  });

  it('runs initial reconciliation after the authorized renewal batch', async () => {
    const renewals = { execute: jest.fn().mockResolvedValue({ processed: 0 }) };
    const initial = {
      executeBatch: jest.fn().mockResolvedValue({ processed: 1, pending: 0 }),
    };
    const usecase = new ProcessSubscriptionPaymentsUseCase(
      renewals as unknown as ProcessDueAutoRenewalsUseCase,
      initial as unknown as ReconcileInitialPaymentsUseCase,
    );
    await expect(usecase.execute(input)).resolves.toEqual({
      processed: 0,
      initialReconciliation: { processed: 1, pending: 0 },
    });
  });
});
