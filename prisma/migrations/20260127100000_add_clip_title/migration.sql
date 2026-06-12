-- AlterTable
ALTER TABLE "Clip"
ADD COLUMN "title" TEXT NOT NULL DEFAULT '';

-- Backfill
UPDATE "Clip"
SET "title" = CASE
  WHEN "type" = 'TEXT' THEN COALESCE("textContent", '')
  WHEN "type" = 'COLOR' THEN COALESCE("colorHex", '')
  WHEN "type" = 'IMAGE' THEN COALESCE("imageUrl", '')
  ELSE ''
END
WHERE "title" = '';

