import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from '@prisma/client';
import { Request } from 'express';
import { Profile, Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: process.env.GOOGLE_REDIRECT_URI ?? '',
      scope: ['profile', 'email'],
      passReqToCallback: true,
    });
  }

  authenticate(req: Request, options?: any) {
    const platform = (req.query.platform as 'WEB' | 'APP') ?? 'WEB';

    const mode = (req.query.mode as 'login' | 'link') ?? 'login';

    // ⭐ OAuth state에 실을 데이터
    const state = Buffer.from(JSON.stringify({ platform, mode })).toString(
      'base64',
    );

    super.authenticate(req, {
      ...options,
      state,
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ) {
    // ⭐ state 복원
    const rawState = req.query.state as string | undefined;

    let platform: 'WEB' | 'APP' = 'WEB';
    let mode: 'login' | 'link' = 'login';

    if (rawState) {
      try {
        const parsed = JSON.parse(Buffer.from(rawState, 'base64').toString());
        platform = parsed.platform ?? platform;
        mode = parsed.mode ?? mode;
      } catch {
        // state 파싱 실패 시 기본값 유지
      }
    }

    return {
      provider: AuthProvider.GOOGLE,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      mode,
      platform, // ✅ 여기서 Service로 전달됨
    };
  }
}
