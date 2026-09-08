ALTER TABLE "SubscriptionPayment"
  ADD COLUMN "renewalDueAt" TIMESTAMP(3),
  ADD COLUMN "renewalPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "reconciliationNextAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconciliationError" TEXT,
  ADD COLUMN "manualReviewAt" TIMESTAMP(3);

-- 기존 미확정 주문에는 청구 당시 기간 스냅샷이 없다. 현재 구독 기간을
-- 추측해 연장하거나 재과금하지 않고 운영 대사 대상으로 보존한다.
UPDATE "SubscriptionPayment"
SET "manualReviewAt" = CURRENT_TIMESTAMP,
    "reconciliationError" = 'LEGACY_PERIOD_SNAPSHOT_MISSING'
WHERE "status" = 'PENDING';

CREATE INDEX "SubscriptionPayment_status_reconciliationNextAt_idx"
  ON "SubscriptionPayment"("status", "reconciliationNextAt");
