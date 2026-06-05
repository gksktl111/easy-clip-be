DELETE FROM "Workspace"
WHERE "type" = 'TEAM';

DROP TABLE IF EXISTS "WorkspaceUser";

DROP INDEX IF EXISTS "Workspace_ownerUserId_type_key";

ALTER TABLE "Workspace"
DROP COLUMN "type";

DROP TYPE IF EXISTS "WorkspaceRole";
DROP TYPE IF EXISTS "WorkspaceType";

ALTER TABLE "Workspace"
ALTER COLUMN "ownerUserId" SET NOT NULL;

CREATE UNIQUE INDEX "Workspace_ownerUserId_key" ON "Workspace"("ownerUserId");
