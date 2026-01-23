/*
  Warnings:

  - Made the column `email` on table `AuthAccount` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AuthAccount" ALTER COLUMN "email" SET NOT NULL;
