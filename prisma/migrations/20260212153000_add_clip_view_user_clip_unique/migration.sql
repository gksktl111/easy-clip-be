-- 기존 중복 조회 기록을 정리하고 사용자-클립 단위 유니크 제약을 추가한다.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "clipId"
      ORDER BY "viewedAt" DESC, "id" DESC
    ) AS rn
  FROM "ClipView"
)
DELETE FROM "ClipView"
WHERE ctid IN (
  SELECT ctid
  FROM ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX "ClipView_userId_clipId_key" ON "ClipView"("userId", "clipId");
