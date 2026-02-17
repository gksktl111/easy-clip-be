/*
  Warnings:

  - Made the column `displayName` on table `AuthAccount` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AuthAccount" ALTER COLUMN "displayName" SET NOT NULL;
