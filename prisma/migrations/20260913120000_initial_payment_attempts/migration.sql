CREATE TABLE "InitialSubscriptionPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reconciliationNextAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subscriptionId" TEXT NOT NULL REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "idempotencyKey" UUID NOT NULL,
  "externalOrderId" TEXT NOT NULL UNIQUE,
  "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER NOT NULL CHECK ("amount" > 0),
  "currency" TEXT NOT NULL,
  "priceVersion" TEXT NOT NULL,
  "customerKey" TEXT NOT NULL,
  "billingKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "InitialSubscriptionPayment_subscriptionId_idempotencyKey_key" ON "InitialSubscriptionPayment"("subscriptionId", "idempotencyKey");
CREATE INDEX "InitialSubscriptionPayment_subscriptionId_status_idx" ON "InitialSubscriptionPayment"("subscriptionId", "status");
CREATE UNIQUE INDEX "InitialSubscriptionPayment_one_pending" ON "InitialSubscriptionPayment"("subscriptionId") WHERE "status" = 'PENDING';
CREATE INDEX "InitialSubscriptionPayment_status_reconciliationNextAt_idx" ON "InitialSubscriptionPayment"("status", "reconciliationNextAt");
