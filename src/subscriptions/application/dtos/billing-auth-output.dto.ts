export type BillingAuthRequestOutput = {
  clientKey: string;
  customerKey: string;
  method: 'CARD';
  successUrl: string;
  failUrl: string;
};

export type ConfirmBillingAuthInput = {
  authKey: string;
  customerKey: string;
};
