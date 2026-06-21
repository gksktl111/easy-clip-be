import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Platform } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/shared/types/auth-context.type';
import type { AuthSessionMetadata } from 'src/shared/types/auth-session-metadata.type';
import type {
  AuthSessionPort,
  IssuedTokens,
  RefreshTokenSession,
} from '../application/ports/auth-session.port';
import type { AuthPlatform } from 'src/shared/types/auth-platform.type';

@Injectable()
export class JwtAuthSessionPort implements AuthSessionPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueTokens(
    context: AuthContext,
    metadata?: AuthSessionMetadata,
  ): Promise<IssuedTokens> {
    const sessionContext = {
      ...context,
      sessionId: randomUUID(),
    };
    const accessToken = this.signAccessToken(sessionContext);
    const refreshToken = this.signRefreshToken(sessionContext);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        id: sessionContext.sessionId,
        userId: sessionContext.userId,
        authAccountId: sessionContext.accountId,
        platform: sessionContext.platform as Platform,
        tokenHash,
        expiresAt: await this.resolveRefreshTokenExpiresAt(refreshToken),
        lastUsedAt: new Date(),
        ...this.toSessionMetadataUpdate(metadata),
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
    sessionId: string,
  ): Promise<RefreshTokenSession | null> {
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        tokenHash: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      tokenHash: session.tokenHash,
      revokedAt: session.revokedAt,
      expiresAt: session.expiresAt,
    };
  }

  async rotateRefreshToken(
    context: AuthContext & { sessionId: string },
    expectedTokenHash: string,
    metadata?: AuthSessionMetadata,
  ): Promise<IssuedTokens | null> {
    const accessToken = this.signAccessToken(context);
    const refreshToken = this.signRefreshToken(context);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const result = await this.prisma.refreshToken.updateMany({
      where: {
        id: context.sessionId,
        tokenHash: expectedTokenHash,
        revokedAt: null,
      },
      data: {
        tokenHash,
        expiresAt: await this.resolveRefreshTokenExpiresAt(refreshToken),
        lastUsedAt: new Date(),
        ...this.toSessionMetadataUpdate(metadata),
      },
    });

    if (result.count === 0) {
      return null;
    }

    return { accessToken, refreshToken };
  }

  async touchRefreshTokenSession(
    sessionId: string,
    metadata?: AuthSessionMetadata,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        lastUsedAt: new Date(),
        ...this.toSessionMetadataUpdate(metadata),
      },
    });
  }

  async revokeRefreshTokenSession(sessionId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
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
      ...(context.sessionId ? { sid: context.sessionId } : {}),
    };
  }

  private async resolveRefreshTokenExpiresAt(
    refreshToken: string,
  ): Promise<Date> {
    const verified = await this.jwtService.verifyAsync<{ exp: number }>(
      refreshToken,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        audience: 'refresh',
        issuer: 'easy-clip',
      },
    );

    return new Date(verified.exp * 1000);
  }

  private toSessionMetadataUpdate(metadata?: AuthSessionMetadata) {
    return {
      ...(metadata?.userAgent ? { userAgent: metadata.userAgent } : {}),
      ...(metadata?.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
    };
  }
}
