/*
  Warnings:

  - You are about to drop the column `userId` on the `Clip` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Folder` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Tag` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ownerId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId,name]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ownerId` to the `Clip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `Folder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Clip" DROP CONSTRAINT "Clip_userId_fkey";

-- DropForeignKey
ALTER TABLE "Folder" DROP CONSTRAINT "Folder_userId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_userId_fkey";

-- DropIndex
DROP INDEX "Clip_userId_idx";

-- DropIndex
DROP INDEX "Folder_userId_idx";

-- DropIndex
DROP INDEX "Subscription_userId_key";

-- DropIndex
DROP INDEX "Tag_userId_name_key";

-- DropIndex
DROP INDEX "User_email_idx";

-- AlterTable
ALTER TABLE "Clip" DROP COLUMN "userId",
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Folder" DROP COLUMN "userId",
ADD COLUMN     "ownerId" TEXT NOT NULL,
ALTER COLUMN "order" SET DEFAULT 0,
ALTER COLUMN "order" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "userId",
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "userId",
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email";

-- CreateIndex
CREATE INDEX "Clip_ownerId_idx" ON "Clip"("ownerId");

-- CreateIndex
CREATE INDEX "Folder_ownerId_idx" ON "Folder"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_ownerId_key" ON "Subscription"("ownerId");

-- CreateIndex
CREATE INDEX "Tag_ownerId_idx" ON "Tag"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_ownerId_name_key" ON "Tag"("ownerId", "name");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AccountOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AccountOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AccountOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AccountOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
