import { Clip, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApplicationError } from '../application/application.error';
import {
  FolderAccess,
  FolderAccessError,
  assertFolderAccess,
} from '../application/folder-access';
import { lockClipQuota, readClipQuota } from './prisma-clip-limit';

export type { FolderAccess } from '../application/folder-access';
export { assertFolderAccess } from '../application/folder-access';

export async function lockWorkspaceAccess(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<FolderAccess> {
  const workspace = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerUserId: true },
  });
  if (!workspace)
    throw new ApplicationError('NOT_FOUND', '워크스페이스를 찾을 수 없습니다.');
  await lockClipQuota(tx, workspace.ownerUserId);
  return resolveFolderAccess(tx, workspaceId);
}

export async function withFolderAccess<T>(
  prisma: PrismaService,
  folderId: string,
  callback: (tx: Prisma.TransactionClient, access: FolderAccess) => Promise<T>,
  options: { allowLocked?: boolean } = {},
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.folder.findUnique({
      where: { id: folderId },
      select: { workspaceId: true },
    });
    if (!candidate)
      throw new ApplicationError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    await lockWorkspaceAccess(tx, candidate.workspaceId);
    await tx.$queryRaw`SELECT "id" FROM "Folder" WHERE "id" = ${folderId} FOR UPDATE`;
    const folder = await tx.folder.findFirst({
      where: { id: folderId, deletedAt: null },
    });
    if (!folder)
      throw new ApplicationError('NOT_FOUND', '폴더를 찾을 수 없습니다.');
    const access = await resolveFolderAccess(tx, folder.workspaceId);
    if (!options.allowLocked) assertFolderAccess(access, folderId);
    return callback(tx, access);
  });
}

export async function withClipAccess<T>(
  prisma: PrismaService,
  clipId: string,
  callback: (
    tx: Prisma.TransactionClient,
    access: FolderAccess,
    clip: Clip,
  ) => Promise<T>,
  userId?: string,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.clip.findFirst({
      where: {
        id: clipId,
        ...(userId ? { workspace: { ownerUserId: userId } } : {}),
      },
      select: { workspaceId: true, folderId: true },
    });
    if (!candidate)
      throw new ApplicationError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    await lockWorkspaceAccess(tx, candidate.workspaceId);
    await tx.$queryRaw`SELECT "id" FROM "Folder" WHERE "id" = ${candidate.folderId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Clip" WHERE "id" = ${clipId} FOR UPDATE`;
    const clip = await tx.clip.findFirst({
      where: { id: clipId, deletedAt: null, folder: { deletedAt: null } },
    });
    if (!clip)
      throw new ApplicationError('NOT_FOUND', '클립을 찾을 수 없습니다.');
    const access = await resolveFolderAccess(tx, clip.workspaceId);
    assertFolderAccess(access, clip.folderId);
    return callback(tx, access, clip);
  });
}

// 구독 잠금을 보유한 트랜잭션에서만 호출한다.
export async function resolveFolderAccess(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<FolderAccess> {
  const quota = await readClipQuota(tx, workspaceId);
  const workspace = await tx.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });
  const subscription = await tx.subscription.findUniqueOrThrow({
    where: { workspaceId },
    select: { currentPeriodEnd: true },
  });
  if (quota.effectivePlan === 'PRO') {
    if (workspace.freeAccessInitialized) {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { freeAccessInitialized: false, freeAccessibleFolderId: null },
      });
    }
    return { ...quota, workspaceId, accessibleFolderId: null };
  }
  const samePeriod =
    workspace.freeAccessPeriodEnd?.getTime() ===
    subscription.currentPeriodEnd?.getTime();
  if (workspace.freeAccessInitialized && samePeriod) {
    // 선택 폴더가 삭제되어도 tombstone을 보존해 다른 기존 자료로 교대 접근하지 못하게 한다.
    const selected = workspace.freeAccessibleFolderId
      ? await tx.folder.findFirst({
          where: { id: workspace.freeAccessibleFolderId, workspaceId },
          select: { id: true },
        })
      : null;
    return { ...quota, workspaceId, accessibleFolderId: selected?.id ?? null };
  }
  const first = await tx.folder.findFirst({
    where: { workspaceId, deletedAt: null },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  await tx.workspace.update({
    where: { id: workspaceId },
    data: {
      freeAccessInitialized: true,
      freeAccessPeriodEnd: subscription.currentPeriodEnd,
      freeAccessibleFolderId: first?.id ?? null,
    },
  });
  return { ...quota, workspaceId, accessibleFolderId: first?.id ?? null };
}

export async function prepareFolderRestore(
  tx: Prisma.TransactionClient,
  access: FolderAccess,
  folderIds: string[],
): Promise<FolderAccess> {
  const ids = [...new Set(folderIds)];
  if (access.effectivePlan === 'PRO' || ids.length === 0) return access;
  if (ids.length > 1)
    throw new FolderAccessError(
      'PLAN_LIMIT_EXCEEDED',
      'Free에서는 폴더 1개만 복구할 수 있습니다.',
    );
  const workspace = await tx.workspace.findUniqueOrThrow({
    where: { id: access.workspaceId },
  });
  if (workspace.freeAccessibleFolderId) {
    assertFolderAccess(
      { ...access, accessibleFolderId: workspace.freeAccessibleFolderId },
      ids[0],
    );
    return { ...access, accessibleFolderId: ids[0] };
  }
  const count = await tx.folder.count({
    where: { workspaceId: access.workspaceId, deletedAt: null },
  });
  if (count > 0)
    throw new FolderAccessError(
      'PLAN_LIMIT_EXCEEDED',
      '활성 폴더가 있으면 다른 폴더를 복구할 수 없습니다.',
    );
  await tx.workspace.update({
    where: { id: access.workspaceId },
    data: { freeAccessibleFolderId: ids[0] },
  });
  return { ...access, accessibleFolderId: ids[0] };
}
