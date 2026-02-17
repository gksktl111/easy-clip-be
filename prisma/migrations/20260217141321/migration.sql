/*
  Warnings:

  - Made the column `displayName` on table `AuthAccount` required. This step will fail if there are existing NULL values in that column.

*/

-- Backfill existing NULL displayName values before NOT NULL constraint
UPDATE "AuthAccount"
SET "displayName" = split_part("email", '@', 1)
WHERE "displayName" IS NULL;

-- AlterTable
ALTER TABLE "AuthAccount" ALTER COLUMN "displayName" SET NOT NULL;
