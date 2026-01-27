-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Clip_workspaceId_deletedAt_idx" ON "Clip"("workspaceId", "deletedAt");
