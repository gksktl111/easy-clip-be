import { Injectable } from '@nestjs/common';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  UpdateAuthAccountProfileParams,
  UpdateUserSettingsParams,
  UsersRepository,
} from '../domain/users.repository';
import {
  UserAuthAccount,
  UserSettings,
  UserSummary,
  UserWithAuthAccounts,
} from '../domain/user.types';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserById(userId: string): Promise<UserSummary | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    return user ?? null;
  }

  async findUserWithAuthAccounts(
    userId: string,
  ): Promise<UserWithAuthAccounts | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        authAccounts: {
          select: {
            id: true,
            provider: true,
            email: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
      },
    });

    return user ?? null;
  }

  async updateAuthAccountProfile(
    accountId: string,
    params: UpdateAuthAccountProfileParams,
  ): Promise<UserAuthAccount> {
    return this.prisma.authAccount.update({
      where: { id: accountId },
      data: {
        ...(params.displayName !== undefined
          ? { displayName: params.displayName }
          : {}),
        ...(params.profileImageUrl !== undefined
          ? { profileImageUrl: params.profileImageUrl ?? null }
          : {}),
      },
      select: {
        id: true,
        provider: true,
        email: true,
        displayName: true,
        profileImageUrl: true,
      },
    });
  }

  async upsertUserSettings(
    userId: string,
    params: UpdateUserSettingsParams,
  ): Promise<UserSettings> {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...(params.theme !== undefined ? { theme: params.theme } : {}),
        ...(params.language !== undefined ? { language: params.language } : {}),
      },
      update: {
        ...(params.theme !== undefined ? { theme: params.theme } : {}),
        ...(params.language !== undefined ? { language: params.language } : {}),
      },
    });
  }

  async hasOwnedTeamWorkspace(userId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        type: WorkspaceType.TEAM,
        OR: [
          { ownerUserId: userId },
          {
            users: {
              some: {
                userId,
                role: WorkspaceRole.OWNER,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    return Boolean(workspace);
  }

  async deleteUserAndOwnedPersonalWorkspaces(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const ownedPersonalWorkspaces = await tx.workspace.findMany({
        where: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
        select: { id: true },
      });

      const workspaceIds = ownedPersonalWorkspaces.map((item) => item.id);

      if (workspaceIds.length > 0) {
        await tx.workspace.deleteMany({
          where: {
            id: {
              in: workspaceIds,
            },
          },
        });
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });
  }
}
