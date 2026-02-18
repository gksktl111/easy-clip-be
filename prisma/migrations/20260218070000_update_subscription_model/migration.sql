-- SubscriptionPlan: PRO|TEAM -> FREE|PRO
BEGIN;
CREATE TYPE "SubscriptionPlan_new" AS ENUM ('FREE', 'PRO');
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription"
ALTER COLUMN "plan" TYPE "SubscriptionPlan_new"
USING (
  CASE
    WHEN "plan"::text = 'TEAM' THEN 'PRO'
    ELSE "plan"::text
  END::"SubscriptionPlan_new"
);
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
DROP TYPE "SubscriptionPlan_old";
COMMIT;

-- SubscriptionStatus: ACTIVE|CANCELED|PAST_DUE -> ACTIVE|CANCELED|EXPIRED
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED');
ALTER TABLE "Subscription" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Subscription"
ALTER COLUMN "status" TYPE "SubscriptionStatus_new"
USING (
  CASE
    WHEN "status"::text = 'PAST_DUE' THEN 'EXPIRED'
    ELSE "status"::text
  END::"SubscriptionStatus_new"
);
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "SubscriptionStatus_old";
COMMIT;

ALTER TABLE "Subscription" RENAME COLUMN "expiresAt" TO "currentPeriodEnd";
ALTER TABLE "Subscription" ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'FREE';
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

UPDATE "Subscription"
SET "autoRenew" = CASE
  WHEN "plan" = 'PRO' AND "status" = 'ACTIVE' THEN true
  ELSE false
END;

-- Personal workspace는 subscription row를 항상 가지도록 백필
INSERT INTO "Subscription" (
  "id",
  "plan",
  "status",
  "autoRenew",
  "startedAt",
  "currentPeriodEnd",
  "workspaceId"
)
SELECT
  concat('sub_', md5(random()::text || clock_timestamp()::text || w."id")),
  'FREE'::"SubscriptionPlan",
  'ACTIVE'::"SubscriptionStatus",
  false,
  NOW(),
  NULL,
  w."id"
FROM "Workspace" w
LEFT JOIN "Subscription" s ON s."workspaceId" = w."id"
WHERE w."type" = 'PERSONAL'
  AND s."id" IS NULL;
