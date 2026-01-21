import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from '@prisma/client';
import { Profile, Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      // 환경변수 기반으로 GitHub OAuth 클라이언트를 설정한다.
      clientID: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      callbackURL: process.env.GITHUB_REDIRECT_URI ?? '',
      scope: ['user:email'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    // GitHub 프로필을 애플리케이션 표준 형태로 정규화한다.
    return {
      provider: AuthProvider.GITHUB,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName ?? profile.username ?? null,
      avatarUrl: profile.photos?.[0]?.value,
    };
  }
}
