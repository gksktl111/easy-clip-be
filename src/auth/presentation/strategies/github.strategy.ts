import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from 'src/shared/types/auth-provider.type';
import { Request } from 'express';
import type { AuthenticateOptions } from 'passport';
import { Profile, Strategy } from 'passport-github2';
import { OAuthUser } from '../../domain/auth.types';
import {
  buildOAuthState,
  parseOAuthState,
  resolveOAuthStateSecret,
} from '../helpers/oauth-state.helper';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GithubStrategy.name);

  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GITHUB_REDIRECT_URI'),
      scope: ['user:email'],
      passReqToCallback: true,
    });
  }

  authenticate(req: Request, options?: AuthenticateOptions): void {
    super.authenticate(req, {
      ...options,
      state: buildOAuthState(req, {
        secret: resolveOAuthStateSecret(this.config),
      }),
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<OAuthUser> {
    const state = parseOAuthState(req.query.state as string | undefined, {
      secret: resolveOAuthStateSecret(this.config),
    });
    const email = await this.resolveEmail(accessToken, profile);

    return {
      provider: AuthProvider.GITHUB,
      providerUserId: profile.id,
      email,
      displayName: profile.displayName ?? profile.username ?? null,
      avatarUrl: profile.photos?.[0]?.value,
      mode: state.mode,
      platform: state.platform,
      currentUserId: state.currentUserId,
    };
  }

  private async resolveEmail(
    accessToken: string,
    profile: Profile,
  ): Promise<string | null> {
    // GitHub profile.emails는 private primary email이 빠질 수 있어 이메일 API 결과를 우선한다.
    const verifiedEmail = await this.fetchVerifiedGithubEmail(accessToken);

    return (
      verifiedEmail ??
      profile.emails?.find((email) => Boolean(email.value))?.value ??
      null
    );
  }

  private async fetchVerifiedGithubEmail(
    accessToken: string,
  ): Promise<string | null> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `GitHub 이메일 조회에 실패했습니다. status=${response.status}`,
        );
        return null;
      }

      const emails = (await response.json()) as GithubEmailResponse[];
      const primaryVerified = emails.find(
        (email) => email.primary && email.verified,
      );
      const verifiedFallback = emails.find((email) => email.verified);

      return primaryVerified?.email ?? verifiedFallback?.email ?? null;
    } catch (error) {
      this.logger.warn(
        `GitHub 이메일 조회 중 오류가 발생했습니다. message=${resolveErrorMessage(error)}`,
      );
      return null;
    }
  }
}

type GithubEmailResponse = {
  email: string;
  primary: boolean;
  verified: boolean;
};

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
