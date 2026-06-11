/*
  Warnings:

  - This migration changes tag ownership from workspace scope to folder scope.
  - If existing tags are shared across multiple folders in the same workspace,
    automatic backfill is ambiguous and should be handled manually before production rollout.
*/

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_workspaceId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Tag_workspaceId_idx";
DROP INDEX IF EXISTS "Tag_workspaceId_name_key";

-- AlterTable
ALTER TABLE "Tag"
DROP COLUMN IF EXISTS "workspaceId",
ADD COLUMN "folderId" TEXT;

-- Backfill folderId for tags already connected to clips.
UPDATE "Tag" AS t
SET "folderId" = source."folderId"
FROM (
  SELECT DISTINCT ON (ct."tagId")
    ct."tagId",
    c."folderId"
  FROM "ClipTag" ct
  JOIN "Clip" c ON c."id" = ct."clipId"
  ORDER BY ct."tagId", c."folderId"
) AS source
WHERE t."id" = source."tagId"
  AND t."folderId" IS NULL;

-- Enforce folder ownership after backfill.
ALTER TABLE "Tag"
ALTER COLUMN "folderId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Tag_folderId_idx" ON "Tag"("folderId");
CREATE UNIQUE INDEX "Tag_folderId_name_key" ON "Tag"("folderId", "name");

-- AddForeignKey
ALTER TABLE "Tag"
ADD CONSTRAINT "Tag_folderId_fkey"
FOREIGN KEY ("folderId") REFERENCES "Folder"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
