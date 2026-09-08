ALTER TABLE "Workspace"
  ADD COLUMN "freeAccessibleFolderId" TEXT,
  ADD COLUMN "freeAccessInitialized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "freeAccessPeriodEnd" TIMESTAMP(3);
