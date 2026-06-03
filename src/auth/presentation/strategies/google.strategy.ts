import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from 'src/common/types/auth-provider.type';
import { Request } from 'express';
import type { AuthenticateOptions } from 'passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthUser } from '../../domain/auth.types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
      scope: ['profile', 'email'],
      passReqToCallback: true,
    });
  }

  authenticate(req: Request, options?: AuthenticateOptions): void {
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

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): OAuthUser {
    // ⭐ state 복원
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
        // state 파싱 실패 시 기본값 유지
      }
    }

    // 명시적으로 OAuthUser 타입 반환
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
