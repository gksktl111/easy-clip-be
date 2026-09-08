export const BILLING_PAYMENT_GATEWAY = Symbol('BILLING_PAYMENT_GATEWAY');

export type IssueBillingKeyParams = {
  authKey: string;
  customerKey: string;
};

export type IssueBillingKeyResult = {
  billingKey: string;
  authenticatedAt: Date;
  method: string;
  rawData: unknown;
};

export type ChargeBillingParams = {
  billingKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  currency: string;
  // 결과 유실을 대사할 수 있는 호출에서만 명시한다.
  timeoutMs?: number;
};

export type ChargeBillingResult = {
  paymentKey: string;
  orderId: string;
  status: 'DONE' | 'FAILED' | 'CANCELED';
  totalAmount: number;
  currency: string;
  approvedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  rawData: unknown;
};

export type LookupBillingPaymentResult = Omit<ChargeBillingResult, 'status'> & {
  status: string;
};

export interface BillingPaymentGateway {
  issueBillingKey(
    params: IssueBillingKeyParams,
  ): Promise<IssueBillingKeyResult>;

  chargeBilling(params: ChargeBillingParams): Promise<ChargeBillingResult>;

  findPaymentByOrderId(
    orderId: string,
  ): Promise<LookupBillingPaymentResult | null>;
}
