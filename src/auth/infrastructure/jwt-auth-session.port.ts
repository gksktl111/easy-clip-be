import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Platform } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/types/auth-context.type';
import type {
  AuthSessionPort,
  IssuedTokens,
  RefreshTokenSession,
} from '../application/ports/auth-session.port';
import type { AuthPlatform } from 'src/common/types/auth-platform.type';

@Injectable()
export class JwtAuthSessionPort implements AuthSessionPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueTokens(context: AuthContext): Promise<IssuedTokens> {
    const accessToken = this.signAccessToken(context);
    const refreshToken = this.signRefreshToken(context);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const verified = await this.jwtService.verifyAsync<{ exp: number }>(
      refreshToken,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        audience: 'refresh',
        issuer: 'easy-clip',
      },
    );

    const expiresAt = new Date(verified.exp * 1000);

    await this.prisma.refreshToken.upsert({
      where: {
        authAccountId_platform: {
          authAccountId: context.accountId,
          platform: context.platform as Platform,
        },
      },
      update: {
        tokenHash,
        revokedAt: null,
        expiresAt,
      },
      create: {
        userId: context.userId,
        authAccountId: context.accountId,
        platform: context.platform as Platform,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  signAccessToken(context: AuthContext): string {
    return this.jwtService.sign(this.toJwtPayload(context), {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '30m',
      audience: 'api',
      issuer: 'easy-clip',
    });
  }

  async findRefreshTokenSession(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<RefreshTokenSession | null> {
    const session = await this.prisma.refreshToken.findUnique({
      where: {
        authAccountId_platform: {
          authAccountId,
          platform: platform as Platform,
        },
      },
      select: {
        tokenHash: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    return session ?? null;
  }

  async revokeRefreshTokens(
    authAccountId: string,
    platform: AuthPlatform,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        authAccountId,
        platform: platform as Platform,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private signRefreshToken(context: AuthContext): string {
    return this.jwtService.sign(this.toJwtPayload(context), {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '14d',
      audience: 'refresh',
      issuer: 'easy-clip',
    });
  }

  private toJwtPayload(context: AuthContext) {
    return {
      sub: context.userId,
      accountId: context.accountId,
      platform: context.platform,
    };
  }
}
