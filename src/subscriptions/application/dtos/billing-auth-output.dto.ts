import { ProMonthlyPrice } from './subscription-price-output.dto';

export type BillingAuthRequestOutput = {
  price: ProMonthlyPrice;
  clientKey: string;
  customerKey: string;
  method: 'CARD';
  successUrl: string;
  failUrl: string;
};

export type ConfirmBillingAuthInput = {
  idempotencyKey: string;
  priceVersion: string;
  authKey: string;
  customerKey: string;
};
