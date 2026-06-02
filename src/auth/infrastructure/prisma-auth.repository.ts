import { Injectable } from '@nestjs/common';
import {
  AuthProvider as PrismaAuthProvider,
  SubscriptionPlan,
  SubscriptionStatus,
  WorkspaceRole,
  WorkspaceType,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AuthRepository,
  CreateAuthAccountInput,
  UserInfo,
} from '../domain/auth.repository';
import { AuthAccount } from '../domain/auth-account.entity';
import { AuthProvider } from '../domain/auth.types';

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

    return account ? this.mapAuthAccount(account) : null;
  }

  async findAccountById(accountId: string): Promise<AuthAccount | null> {
    const account = await this.prisma.authAccount.findUnique({
      where: { id: accountId },
    });

    return account ? this.mapAuthAccount(account) : null;
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
    const resolvedDisplayName = this.resolveDisplayName(
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

    return this.mapAuthAccount(account);
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
        displayName: this.resolveDisplayName(input.displayName, input.email),
        profileImageUrl: input.profileImageUrl ?? null,
      },
    });

    return this.mapAuthAccount(account);
  }

  private mapAuthAccount(account: {
    id: string;
    userId: string;
    provider: PrismaAuthProvider;
    providerUserId: string;
    email: string;
    displayName: string | null;
    profileImageUrl: string | null;
  }): AuthAccount {
    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider as AuthProvider,
      providerUserId: account.providerUserId,
      email: account.email,
      displayName: this.resolveDisplayName(
        account.displayName ?? undefined,
        account.email,
      ),
      profileImageUrl: account.profileImageUrl,
    };
  }

  private resolveDisplayName(
    displayName: string | undefined,
    email: string,
  ): string {
    const normalizedDisplayName = displayName?.trim();

    if (normalizedDisplayName) {
      return normalizedDisplayName;
    }

    const emailName = email.split('@')[0]?.trim();

    if (emailName) {
      return emailName;
    }

    return '사용자';
  }
}
