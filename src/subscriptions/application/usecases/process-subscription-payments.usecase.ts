import { Injectable } from '@nestjs/common';
import {
  ProcessDueAutoRenewalsUseCase,
  ProcessDueAutoRenewalsInput,
} from './process-due-auto-renewals.usecase';
import { ReconcileInitialPaymentsUseCase } from './reconcile-initial-payments.usecase';

@Injectable()
export class ProcessSubscriptionPaymentsUseCase {
  constructor(
    private readonly renewals: ProcessDueAutoRenewalsUseCase,
    private readonly initialPayments: ReconcileInitialPaymentsUseCase,
  ) {}

  async execute(input: ProcessDueAutoRenewalsInput) {
    // Existing batch access policy must succeed before any initial-payment lookup.
    const result = await this.renewals.execute(input);
    const initialReconciliation = await this.initialPayments.executeBatch();
    return { ...result, initialReconciliation };
  }
}
