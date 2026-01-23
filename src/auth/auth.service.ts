import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthAccount, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthPlatform, JwtPayload, OAuthUser } from './auth';
import { createHash } from 'crypto';

type OAuthSignInResult = {
  access_token: string;
  refresh_token: string;
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
      const account = (await this.prisma.authAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: oauthUser.provider,
            providerUserId: oauthUser.providerUserId,
          },
        },
        include: { user: true },
      })) as (AuthAccount & { user: User }) | null;

      if (!account) {
        // 이론상 발생하면 안 되는 상태
        // = DB 무결성 / 트랜잭션 / 레이스 컨디션 문제
        throw new InternalServerErrorException(
          '계정 연동 후 상태를 확인할 수 없습니다.',
        );
      }

      return this.issueAuthToken(account.user, account, oauthUser.platform);
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
    const existingAccount = (await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: oauthUser.provider,
          providerUserId: oauthUser.providerUserId,
        },
      },
      include: { user: true },
    })) as (AuthAccount & { user: User }) | null;

    // 2️⃣ 이미 연동된 계정 → 로그인
    if (existingAccount) {
      return this.issueAuthToken(
        existingAccount.user,
        existingAccount,
        oauthUser.platform,
      );
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
    const newUser = (await this.prisma.user.create({
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
    })) as User & { authAccounts: AuthAccount[] };

    const newAccount = newUser.authAccounts[0];

    return this.issueAuthToken(newUser, newAccount, oauthUser.platform);
  }

  /**
   * OAuth 계정 추가 (JWT 인증된 상태 전용)
   */
  private async linkWithOAuth(
    userId: string,
    oauthUser: OAuthUser,
  ): Promise<void> {
    if (!oauthUser.email) {
      throw new BadRequestException('OAuth 이메일 정보를 가져올 수 없습니다.');
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
    platform: AuthPlatform,
  ): Promise<OAuthSignInResult> {
    const targetAccount = (await this.prisma.authAccount.findUnique({
      where: { id: targetAuthAccountId },
      include: { user: true },
    })) as (AuthAccount & { user: User }) | null;

    if (!targetAccount) {
      throw new NotFoundException('전환할 계정을 찾을 수 없습니다.');
    }

    if (targetAccount.userId !== currentUserId) {
      throw new ForbiddenException('연동되지 않은 계정입니다.');
    }

    return this.issueAuthToken(targetAccount.user, targetAccount, platform);
  }

  /**
   * 토큰 재발급
   * 현재는 access token만 재발급 추후에 jwt 슬라이드에 refresh token 재발급 기능 추가 가능
   */
  async refreshAccessToken(
    payload: JwtPayload,
    refreshToken: string,
  ): Promise<{ access_token: string }> {
    const { sub: userId, accountId, platform } = payload;

    const session = (await this.prisma.refreshToken.findUnique({
      where: {
        authAccountId_platform: {
          authAccountId: accountId,
          platform,
        },
      },
    })) as {
      tokenHash: string;
      revokedAt: Date | null;
      expiresAt: Date;
    } | null;

    if (!session) {
      throw new UnauthorizedException('리프레쉬 세션이 존재하지 않습니다.');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('폐기된 리프레쉬 토큰입니다.');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('리프레쉬 토큰이 만료되었습니다.');
    }

    const incomingHash = createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    if (incomingHash !== session.tokenHash) {
      throw new UnauthorizedException('리프레쉬 토큰이 일치하지 않습니다.');
    }

    // ✅ access token만 재발급
    const accessToken = this.signAccessToken({
      sub: userId,
      accountId,
      platform,
    });

    return {
      access_token: accessToken,
    };
  }
  /**
   * 로그아웃
   */
  async logout(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<{ success: true }> {
    await this.prisma.refreshToken.updateMany({
      where: {
        authAccountId,
        platform,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  private signAccessToken(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
      audience: 'api',
      issuer: 'easy-clip',
    });
  }

  private signRefreshToken(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '14d',
      audience: 'refresh',
      issuer: 'easy-clip',
    });
  }

  private async issueAuthToken(
    user: User,
    account: AuthAccount,
    platform: 'WEB' | 'APP',
  ): Promise<OAuthSignInResult> {
    const payload = {
      sub: user.id,
      accountId: account.id,
      platform,
    };

    const accessToken = this.signAccessToken(payload);

    const refreshToken = this.signRefreshToken(payload);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    // verifyAsync를 사용하여 타입 안전하게 토큰 검증
    let expiresAt: Date;
    try {
      const verified = await this.jwtService.verifyAsync<{ exp: number }>(
        refreshToken,
        {
          secret: process.env.JWT_REFRESH_SECRET,
          audience: 'refresh',
          issuer: 'easy-clip',
        },
      );
      expiresAt = new Date(verified.exp * 1000);
    } catch {
      throw new InternalServerErrorException(
        '유효하지 않은 리프레쉬 토큰입니다.',
      );
    }

    await this.prisma.refreshToken.upsert({
      where: {
        authAccountId_platform: {
          authAccountId: account.id,
          platform,
        },
      },
      update: {
        tokenHash,
        revokedAt: null,
        expiresAt,
      },
      create: {
        userId: user.id,
        authAccountId: account.id,
        platform,
        tokenHash,
        expiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        displayName: account.displayName ?? null,
        avatarUrl: account.profileImageUrl ?? null,
      },
    };
  }
}
