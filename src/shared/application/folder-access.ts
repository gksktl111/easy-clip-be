import { ApplicationError } from './application.error';
import { ClipEntitlements } from './clip-limit';

export type FolderAccess = ClipEntitlements & {
  workspaceId: string;
  accessibleFolderId: string | null;
};

export class FolderAccessError extends ApplicationError {
  constructor(
    public readonly policyCode:
      | 'PROJECT_LOCKED'
      | 'PLAN_LIMIT_EXCEEDED'
      | 'FEATURE_NOT_AVAILABLE',
    message: string,
  ) {
    super(
      policyCode === 'PLAN_LIMIT_EXCEEDED' ? 'CONFLICT' : 'FORBIDDEN',
      message,
    );
  }
}

export function assertFolderAccess(
  access: FolderAccess,
  folderId: string,
): void {
  if (
    access.effectivePlan === 'FREE' &&
    access.accessibleFolderId !== folderId
  ) {
    throw new FolderAccessError(
      'PROJECT_LOCKED',
      'Free에서는 접근 폴더 1개만 열람·편집할 수 있습니다.',
    );
  }
}

export function assertProFeature(
  access: Pick<ClipEntitlements, 'effectivePlan'>,
  feature: 'CLIP_SEARCH' | 'TAG_MANAGEMENT',
): void {
  if (access.effectivePlan !== 'PRO') {
    throw new FolderAccessError(
      'FEATURE_NOT_AVAILABLE',
      feature === 'CLIP_SEARCH'
        ? '클립 검색은 Pro에서 사용할 수 있습니다.'
        : '태그 관리는 Pro에서 사용할 수 있습니다.',
    );
  }
}
