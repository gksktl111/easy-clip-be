import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from '@prisma/client';
import { Request } from 'express';
import { Profile, Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      callbackURL: process.env.GITHUB_REDIRECT_URI ?? '',
      scope: ['user:email'],
      passReqToCallback: true, // ⭐ 동일
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ) {
    const mode = (req.query.mode as 'login' | 'link') ?? 'login';

    return {
      provider: AuthProvider.GITHUB,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName ?? profile.username ?? null,
      avatarUrl: profile.photos?.[0]?.value,
      mode,
    };
  }
}
