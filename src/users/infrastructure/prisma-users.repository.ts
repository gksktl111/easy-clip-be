import { Injectable } from '@nestjs/common';
import type { UserSettings as PrismaUserSettings } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  UpdateAuthAccountProfileParams,
  UpdateUserSettingsParams,
  UsersRepository,
} from '../domain/users.repository';
import {
  UserAuthAccount,
  UserLanguage,
  UserSettings,
  UserSummary,
  UserTheme,
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
    const settings = await this.prisma.userSettings.upsert({
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

    return this.toUserSettings(settings);
  }

  async deleteUserAndOwnedPersonalWorkspaces(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({
        where: {
          userId,
        },
      });

      const ownedPersonalWorkspaces = await tx.workspace.findMany({
        where: {
          ownerUserId: userId,
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

  private toUserSettings(settings: PrismaUserSettings): UserSettings {
    return {
      ...settings,
      // 마이그레이션과 요청 검증이 theme 값을 도메인 계약 안으로 제한한다.
      theme: settings.theme as UserTheme,
      language: settings.language as UserLanguage,
    };
  }
}
