const PRO_BILLING_MONTHS = 1;

export function resolveNextPeriod(currentPeriodEnd: Date | null, paidAt: Date) {
  const start =
    currentPeriodEnd && currentPeriodEnd > paidAt ? currentPeriodEnd : paidAt;
  const end = new Date(start);
  end.setMonth(end.getMonth() + PRO_BILLING_MONTHS);

  return {
    startedAt: start,
    currentPeriodEnd: end,
    nextBillingAt: end,
  };
}
