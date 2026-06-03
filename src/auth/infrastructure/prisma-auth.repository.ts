import { Injectable } from '@nestjs/common';
import { AuthProvider } from 'src/common/types/auth-provider.type';
import {
  AuthProvider as PrismaAuthProvider,
  SubscriptionPlan,
  SubscriptionStatus,
  WorkspaceRole,
  WorkspaceType,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  toAuthAccount,
  resolveDisplayName,
} from './mappers/auth-account.mapper';
import { AuthAccount } from '../domain/auth-account.entity';
import {
  AuthRepository,
  CreateAuthAccountInput,
  UserInfo,
} from '../domain/auth.repository';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAccountByProvider(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<AuthAccount | null> {
    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: provider as PrismaAuthProvider,
          providerUserId,
        },
      },
    });

    return account ? toAuthAccount(account) : null;
  }

  async findAccountById(accountId: string): Promise<AuthAccount | null> {
    const account = await this.prisma.authAccount.findUnique({
      where: { id: accountId },
    });

    return account ? toAuthAccount(account) : null;
  }

  async findUserById(userId: string): Promise<UserInfo | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    return user ?? null;
  }

  async findUserByAuthEmail(email: string): Promise<UserInfo | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        authAccounts: {
          some: {
            email,
          },
        },
      },
      select: { id: true },
    });

    return user ?? null;
  }

  async createUserWithAuthAccount(
    input: CreateAuthAccountInput,
  ): Promise<AuthAccount> {
    const resolvedDisplayName = resolveDisplayName(
      input.displayName,
      input.email,
    );

    const account = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          authAccounts: {
            create: {
              provider: input.provider as PrismaAuthProvider,
              providerUserId: input.providerUserId,
              email: input.email,
              displayName: resolvedDisplayName,
              profileImageUrl: input.profileImageUrl ?? null,
            },
          },
        },
        include: {
          authAccounts: true,
        },
      });

      await tx.workspace.create({
        data: {
          name: 'Personal Workspace',
          type: WorkspaceType.PERSONAL,
          ownerUserId: user.id,
          users: {
            create: {
              userId: user.id,
              role: WorkspaceRole.OWNER,
            },
          },
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

      return user.authAccounts[0];
    });

    return toAuthAccount(account);
  }

  async createAuthAccountForUser(
    userId: string,
    input: CreateAuthAccountInput,
  ): Promise<AuthAccount> {
    const account = await this.prisma.authAccount.create({
      data: {
        userId,
        provider: input.provider as PrismaAuthProvider,
        providerUserId: input.providerUserId,
        email: input.email,
        displayName: resolveDisplayName(input.displayName, input.email),
        profileImageUrl: input.profileImageUrl ?? null,
      },
    });

    return toAuthAccount(account);
  }
}
