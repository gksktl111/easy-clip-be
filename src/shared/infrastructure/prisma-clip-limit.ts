import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ApplicationError } from '../application/application.error';
import { resolveClipEntitlements } from '../application/clip-limit';

// 생성·복구와 결제 상태 변경은 같은 구독 행에서 직렬화한다.
export async function lockClipQuota(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const workspace = await tx.workspace.findUnique({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  if (!workspace)
    throw new ApplicationError('NOT_FOUND', '워크스페이스를 찾을 수 없습니다.');
  // 기존 계정의 누락된 Free 구독도 같은 잠금 경계에 참여시킨다.
  await tx.$executeRaw`INSERT INTO "Subscription" ("id", "workspaceId") VALUES (${randomUUID()}, ${workspace.id}) ON CONFLICT ("workspaceId") DO NOTHING`;
  await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "workspaceId" = ${workspace.id} FOR UPDATE`;
  return workspace.id;
}

export async function readClipQuota(
  tx: Prisma.TransactionClient,
  workspaceId: string,
) {
  const subscription = await tx.subscription.findUniqueOrThrow({
    where: { workspaceId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  return resolveClipEntitlements(subscription, new Date());
}
