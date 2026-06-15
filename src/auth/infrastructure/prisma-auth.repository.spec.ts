import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaAuthRepository } from './prisma-auth.repository';

describe('PrismaAuthRepository', () => {
  it('신규 회원가입 시 개인 워크스페이스와 기본 사용자 설정을 함께 생성한다', async () => {
    const tx = {
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'user-id',
          authAccounts: [
            {
              id: 'account-id',
              userId: 'user-id',
              provider: 'GOOGLE',
              providerUserId: 'provider-user-id',
              email: 'user@example.com',
              displayName: 'Test User',
              profileImageUrl: null,
            },
          ],
        }),
      },
      workspace: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      userSettings: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: typeof tx) => callback(tx)),
    } as never;

    const repository = new PrismaAuthRepository(prisma);

    await repository.createUserWithAuthAccount({
      provider: 'GOOGLE',
      providerUserId: 'provider-user-id',
      email: 'user@example.com',
      displayName: 'Test User',
      profileImageUrl: null,
    });

    expect(tx.user.create).toHaveBeenCalled();
    expect(tx.workspace.create).toHaveBeenCalledWith({
      data: {
        name: 'Personal Workspace',
        ownerUserId: 'user-id',
        subscription: {
          create: {
            plan: SubscriptionPlan.FREE,
            status: SubscriptionStatus.ACTIVE,
            autoRenew: false,
            currentPeriodEnd: null,
          },
        },
      },
    });
    expect(tx.userSettings.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-id',
      },
    });
  });
});
