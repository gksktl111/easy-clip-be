import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthProvider as PrismaAuthProvider, Platform } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AuthRepository,
  CreateAuthAccountInput,
  IssuedTokens,
  RefreshTokenSession,
  UserInfo,
} from '../domain/auth.repository';
import { AuthAccount } from '../domain/auth-account.entity';
import { AuthContext } from '../application/auth-context';
import { AuthPlatform, AuthProvider } from '../domain/auth.types';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

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
    const user = await this.prisma.user.create({
      data: {
        authAccounts: {
          create: {
            provider: input.provider as PrismaAuthProvider,
            providerUserId: input.providerUserId,
            email: input.email,
            displayName: this.resolveDisplayName(
              input.displayName,
              input.email,
            ),
            profileImageUrl: input.profileImageUrl ?? null,
          },
        },
      },
      include: {
        authAccounts: true,
      },
    });

    const account = user.authAccounts[0];

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
      expiresIn: '15m',
      audience: 'api',
      issuer: 'easy-clip',
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

  private toJwtPayload(context: AuthContext) {
    return {
      sub: context.userId,
      accountId: context.accountId,
      platform: context.platform,
    };
  }
}
