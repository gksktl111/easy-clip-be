import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from 'src/common/types/auth-provider.type';
import { Request } from 'express';
import type { AuthenticateOptions } from 'passport';
import { Profile, Strategy } from 'passport-github2';
import { OAuthUser } from '../../domain/auth.types';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
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
    const platform = (req.query.platform as 'WEB' | 'APP') ?? 'WEB';
    const mode = (req.query.mode as 'login' | 'link') ?? 'login';

    const state = Buffer.from(JSON.stringify({ platform, mode })).toString(
      'base64',
    );

    super.authenticate(req, {
      ...options,
      state,
    });
  }

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): OAuthUser {
    const rawState = req.query.state as string | undefined;

    let platform: 'WEB' | 'APP' = 'WEB';
    let mode: 'login' | 'link' = 'login';

    if (rawState) {
      try {
        const parsed = JSON.parse(
          Buffer.from(rawState, 'base64').toString(),
        ) as { platform?: 'WEB' | 'APP'; mode?: 'login' | 'link' };

        platform = parsed.platform ?? platform;
        mode = parsed.mode ?? mode;
      } catch {
        // state 파싱 실패 → 기본값 유지
      }
    }

    return {
      provider: AuthProvider.GITHUB,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName ?? profile.username ?? null,
      avatarUrl: profile.photos?.[0]?.value,
      mode,
      platform,
    };
  }
}
