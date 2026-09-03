-- CreateEnum
CREATE TYPE "TagBackgroundColor" AS ENUM (
  'GRAY',
  'BROWN',
  'ORANGE',
  'YELLOW',
  'GREEN',
  'BLUE',
  'PURPLE',
  'PINK',
  'RED'
);

-- AlterTable
ALTER TABLE "Tag"
ADD COLUMN "backgroundColor" "TagBackgroundColor" NOT NULL DEFAULT 'GRAY';
