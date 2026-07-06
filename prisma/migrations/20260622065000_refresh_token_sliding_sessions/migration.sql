-- AlterTable
ALTER TABLE "RefreshToken"
ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "RefreshToken" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropIndex
DROP INDEX "RefreshToken_authAccountId_platform_key";

-- CreateIndex
CREATE INDEX "RefreshToken_authAccountId_platform_idx" ON "RefreshToken"("authAccountId", "platform");
