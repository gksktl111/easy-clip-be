-- 구버전 자동갱신 FAILED는 실제 과금 여부를 확정하지 못한다.
-- 자동갱신 주문 형식 전체를 구독 ID와 대조하며 최초 결제 주문은 건드리지 않는다.
-- 실패 코드/시각/원본 응답은 감사 근거로 보존한다.
UPDATE "SubscriptionPayment"
SET "status" = 'PENDING',
    "reconciliationAttempts" = 0,
    "reconciliationNextAt" = CASE
      WHEN "renewalDueAt" IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
    "manualReviewAt" = CASE
      WHEN "renewalDueAt" IS NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
    "reconciliationError" = CASE
      WHEN "renewalDueAt" IS NULL THEN 'LEGACY_FAILED_PERIOD_SNAPSHOT_MISSING'
      ELSE 'LEGACY_FAILED_REQUIRES_RECONCILIATION' END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'FAILED'
  AND "provider" = 'TOSS_PAYMENTS'
  AND left("externalOrderId", length('sub_' || "subscriptionId" || '_'))
      = 'sub_' || "subscriptionId" || '_'
  AND substring("externalOrderId" FROM length('sub_' || "subscriptionId" || '_') + 1)
      ~ '^[0-9]{14}$'
  AND "manualReviewAt" IS NULL;

CREATE INDEX "Subscription_auto_renewal_due_idx"
  ON "Subscription"("plan", "status", "autoRenew", "nextBillingAt", "id");
