-- DropForeignKey
ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_ownerUserId_fkey";

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
