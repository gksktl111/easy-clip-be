-- Theme enum에서 SYSTEM을 제거하기 전에 기존 값을 새 기본 정책인 LIGHT로 보정한다.
UPDATE "UserSettings"
SET "theme" = 'LIGHT'
WHERE "theme" = 'SYSTEM';

ALTER TABLE "UserSettings" ALTER COLUMN "theme" DROP DEFAULT;

-- PostgreSQL enum 값은 직접 삭제할 수 없어 새 enum으로 교체한다.
CREATE TYPE "Theme_new" AS ENUM ('LIGHT', 'DARK');

ALTER TABLE "UserSettings"
  ALTER COLUMN "theme" TYPE "Theme_new"
  USING ("theme"::text::"Theme_new");

ALTER TYPE "Theme" RENAME TO "Theme_old";
ALTER TYPE "Theme_new" RENAME TO "Theme";

DROP TYPE "Theme_old";

ALTER TABLE "UserSettings" ALTER COLUMN "theme" SET DEFAULT 'LIGHT';
