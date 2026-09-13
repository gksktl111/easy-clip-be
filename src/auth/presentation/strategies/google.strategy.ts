import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from 'src/shared/types/auth-provider.type';
import { BadRequestException } from '@nestjs/common';
import { OAuthStateRequest } from '../guards/oauth-state.guard';
import type { AuthenticateOptions } from 'passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthUser } from '../../domain/auth.types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
      scope: ['profile', 'email'],
      passReqToCallback: true,
    });
  }

  authenticate(req: OAuthStateRequest, options?: AuthenticateOptions): void {
    super.authenticate(req, {
      ...options,
      state: req.oauthState,
    });
  }

  validate(
    req: OAuthStateRequest,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): OAuthUser {
    const state = req.verifiedOAuthState;
    if (!state) throw new BadRequestException('OAuth state 검증이 필요합니다.');

    return {
      provider: AuthProvider.GOOGLE,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      mode: state.mode,
      platform: state.platform,
      currentUserId: state.currentUserId,
    };
  }
}
