CREATE TYPE "PaymentProvider" AS ENUM ('TOSS_PAYMENTS');

CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('DONE', 'FAILED', 'CANCELED');

ALTER TABLE "Subscription"
ADD COLUMN "nextBillingAt" TIMESTAMP(3),
ADD COLUMN "provider" "PaymentProvider",
ADD COLUMN "externalBillingKey" TEXT,
ADD COLUMN "externalCustomerKey" TEXT;

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL,
    "externalPaymentKey" TEXT,
    "externalOrderId" TEXT NOT NULL,
    "externalEventId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "approvedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "rawData" JSONB,
    "subscriptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_externalCustomerKey_key" ON "Subscription"("externalCustomerKey");
CREATE UNIQUE INDEX "SubscriptionPayment_externalPaymentKey_key" ON "SubscriptionPayment"("externalPaymentKey");
CREATE UNIQUE INDEX "SubscriptionPayment_externalOrderId_key" ON "SubscriptionPayment"("externalOrderId");
CREATE UNIQUE INDEX "SubscriptionPayment_externalEventId_key" ON "SubscriptionPayment"("externalEventId");
CREATE INDEX "SubscriptionPayment_subscriptionId_status_idx" ON "SubscriptionPayment"("subscriptionId", "status");
CREATE INDEX "SubscriptionPayment_provider_idx" ON "SubscriptionPayment"("provider");

ALTER TABLE "SubscriptionPayment"
ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
