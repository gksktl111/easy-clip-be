import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthProvider, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export type OAuthUser = {
  provider: AuthProvider;
  providerUserId: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type OAuthContext = {
  mode: 'login' | 'link';
  oauthUser: OAuthUser;
  currentUserId?: string;
};

type OAuthSignInResult = {
  access_token: string;
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async signInWithOAuth(oauthUser: OAuthUser): Promise<OAuthSignInResult> {
    if (!oauthUser.email) {
      throw new BadRequestException('OAuth 인증에 실패했습니다.');
    }

    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: oauthUser.provider,
          providerUserId: oauthUser.providerUserId,
        },
      },
      include: { user: true },
    });

    if (!account) {
      // 🔒 “연동되지 않은 계정”
      throw new NotFoundException('연동된 계정을 찾을 수 없습니다.');
    }

    // 로그인 = 토큰 발급
    return this.issueAuthToken(account.user);
  }

  async linkOAuthAccount(userId: string, oauthUser: OAuthUser) {}

  async switchUser(
    currentUserId: string,
    targetAuthAccountId: string,
  ): Promise<OAuthSignInResult> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
    });

    if (!currentUser) {
      throw new NotFoundException('현재 사용자를 찾을 수 없습니다.');
    }

    const targetAccount = await this.prisma.authAccount.findUnique({
      where: { id: targetAuthAccountId },
    });

    if (!targetAccount) {
      throw new NotFoundException('전환할 계정을 찾을 수 없습니다.');
    }

    if (targetAccount.userId !== currentUserId) {
      throw new ForbiddenException('연동되지 않은 계정입니다.');
    }

    // 연동된 계정으로 JWT를 재발급한다.
    return this.issueAuthToken(currentUser);
  }

  private async createOAuthUser(
    oauthUser: OAuthUser,
    email: string,
  ): Promise<User> {
    // OAuth 계정용 유저를 생성한다.
    return this.prisma.user.create({
      data: {
        displayName: oauthUser.displayName ?? null,
        avatarUrl: oauthUser.avatarUrl ?? null,
      },
    });
  }

  private async issueAuthToken(user: User): Promise<OAuthSignInResult> {
    // JWT payload를 구성한다.
    const payload = { sub: user.id };

    // 토큰을 발급한다.
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        displayName: user.displayName ?? null,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }
}
