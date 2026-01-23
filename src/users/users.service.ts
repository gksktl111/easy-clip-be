import { Injectable, NotFoundException } from '@nestjs/common';
import type { User, AuthAccount } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string, accountId: string) {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authAccounts: true },
    })) as (User & { authAccounts: AuthAccount[] }) | null;

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const account = user.authAccounts.find((a) => a.id === accountId);

    if (!account) {
      throw new NotFoundException('계정 정보를 찾을 수 없습니다.');
    }

    return {
      id: user.id,
      displayName: account.displayName ?? null,
      avatarUrl: account.profileImageUrl ?? null,
      authAccounts: user.authAccounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        email: a.email,
      })),
    };
  }
}
