import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthAccount, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { OAuthUser } from './auth';

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
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // OAuth 진입점
  async handleOAuthCallback(oauthUser: OAuthUser): Promise<OAuthSignInResult> {
    // mode === 'link'
    if (oauthUser.mode === 'link') {
      if (!oauthUser.currentUserId) {
        throw new ForbiddenException('로그인이 필요합니다.');
      }

      await this.linkWithOAuth(oauthUser.currentUserId, oauthUser);

      // link 후에는 "기존 계정 유지"
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
        // 이론상 발생하면 안 되는 상태
        // = DB 무결성 / 트랜잭션 / 레이스 컨디션 문제
        throw new InternalServerErrorException(
          '계정 연동 후 상태를 확인할 수 없습니다.',
        );
      }

      return this.issueAuthToken(account.user, account);
    }

    // mode === 'login'
    return this.logInWithOAuth(oauthUser);
  }

  /**
   * OAuth 로그인 (login 전용)
   * - account 존재 → 로그인
   * - account 없음 + 신규 → user + account 생성
   * - account 없음 + email 중복 → link 유도
   */
  private async logInWithOAuth(
    oauthUser: OAuthUser,
  ): Promise<OAuthSignInResult> {
    if (!oauthUser.email) {
      throw new BadRequestException('OAuth 이메일 정보를 가져올 수 없습니다.');
    }

    // 1️⃣ provider + providerUserId 기준 AuthAccount 조회
    const existingAccount = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: oauthUser.provider,
          providerUserId: oauthUser.providerUserId,
        },
      },
      include: { user: true },
    });

    // 2️⃣ 이미 연동된 계정 → 로그인
    if (existingAccount) {
      return this.issueAuthToken(existingAccount.user, existingAccount);
    }

    // 3️⃣ email 기준 기존 User 존재 여부 확인 (AuthAccount 기준)
    const userWithSameEmail = await this.prisma.user.findFirst({
      where: {
        authAccounts: {
          some: {
            email: oauthUser.email,
          },
        },
      },
    });

    if (userWithSameEmail) {
      // ❌ 자동 연동 금지
      throw new ConflictException(
        '이미 가입된 계정이 있습니다. 계정 연결을 사용해주세요.',
      );
    }

    // 4️⃣ 신규 User + AuthAccount 생성
    const newUser = await this.prisma.user.create({
      data: {
        authAccounts: {
          create: {
            provider: oauthUser.provider,
            providerUserId: oauthUser.providerUserId,
            email: oauthUser.email,
            displayName: oauthUser.displayName ?? null,
            profileImageUrl: oauthUser.avatarUrl ?? null,
          },
        },
      },
      include: {
        authAccounts: true,
      },
    });

    const newAccount = newUser.authAccounts[0];

    return this.issueAuthToken(newUser, newAccount);
  }

  /**
   * OAuth 계정 추가 연동 (JWT 인증된 상태 전용)
   */
  private async linkWithOAuth(
    userId: string,
    oauthUser: OAuthUser,
  ): Promise<void> {
    console.log(userId, oauthUser);

    if (!oauthUser.email) {
      throw new BadRequestException('로그인이 필요합니다.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const existingAccount = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: oauthUser.provider,
          providerUserId: oauthUser.providerUserId,
        },
      },
    });

    if (existingAccount) {
      throw new ConflictException('이미 연동된 OAuth 계정입니다.');
    }

    await this.prisma.authAccount.create({
      data: {
        provider: oauthUser.provider,
        providerUserId: oauthUser.providerUserId,
        email: oauthUser.email,
        displayName: oauthUser.displayName ?? null,
        profileImageUrl: oauthUser.avatarUrl ?? null,
        userId,
      },
    });
  }

  /**
   * 계정 스위칭
   */
  async switchUser(
    currentUserId: string,
    targetAuthAccountId: string,
  ): Promise<OAuthSignInResult> {
    const targetAccount = await this.prisma.authAccount.findUnique({
      where: { id: targetAuthAccountId },
      include: { user: true },
    });

    if (!targetAccount) {
      throw new NotFoundException('전환할 계정을 찾을 수 없습니다.');
    }

    if (targetAccount.userId !== currentUserId) {
      throw new ForbiddenException('연동되지 않은 계정입니다.');
    }

    return this.issueAuthToken(targetAccount.user, targetAccount);
  }

  /**
   * JWT 발급
   * - userId + accountId 모두 포함
   */
  private async issueAuthToken(
    user: User,
    account: AuthAccount,
  ): Promise<OAuthSignInResult> {
    const payload = {
      sub: user.id,
      accountId: account.id,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        displayName: account.displayName ?? null,
        avatarUrl: account.profileImageUrl ?? null,
      },
    };
  }
}
