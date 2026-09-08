import { ApplicationError } from './application.error';

export type ClipEntitlements = { effectivePlan: 'FREE' | 'PRO'; limit: number };

export function resolveClipEntitlements(
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: Date | null;
  },
  now: Date,
): ClipEntitlements {
  const pro =
    subscription.plan === 'PRO' &&
    ['ACTIVE', 'CANCELED'].includes(subscription.status) &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd > now;
  return { effectivePlan: pro ? 'PRO' : 'FREE', limit: pro ? 300 : 50 };
}

export class ClipLimitError extends ApplicationError {
  readonly policyCode = 'CLIP_LIMIT_EXCEEDED';
  constructor(
    public readonly details: {
      resource: 'clips';
      folderId: string;
      limit: number;
      currentCount: number;
      requestedIncrease: number;
      upgradeCanResolve: boolean;
    },
  ) {
    super(
      'CONFLICT',
      `폴더의 클립 추가 저장 한도(${details.limit}개)를 초과합니다.`,
    );
  }
}

export function assertClipIncrease(
  entitlements: ClipEntitlements,
  folderId: string,
  currentCount: number,
  requestedIncrease: number,
): void {
  if (
    requestedIncrease > 0 &&
    currentCount + requestedIncrease > entitlements.limit
  ) {
    throw new ClipLimitError({
      resource: 'clips',
      folderId,
      limit: entitlements.limit,
      currentCount,
      requestedIncrease,
      upgradeCanResolve:
        entitlements.effectivePlan === 'FREE' &&
        currentCount + requestedIncrease <= 300,
    });
  }
}
