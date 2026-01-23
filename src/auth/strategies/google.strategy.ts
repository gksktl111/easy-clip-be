import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from '@prisma/client';
import { Request } from 'express';
import { Profile, Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      // 환경변수 기반으로 Google OAuth 클라이언트를 설정한다.
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: process.env.GOOGLE_REDIRECT_URI ?? '',
      scope: ['profile', 'email'],
      passReqToCallback: true, // ⭐ 핵심
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ) {
    // mode는 'login' 또는 'link'로 사용될 수 있으며, 필요에 따라 처리할 수 있다.
    const mode = (req.query.mode as 'login' | 'link') ?? 'login';

    // Google 프로필을 애플리케이션 표준 형태로 정규화한다.
    return {
      provider: AuthProvider.GOOGLE,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      mode,
    };
  }
}
