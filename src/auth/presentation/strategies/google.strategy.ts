import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from 'src/shared/types/auth-provider.type';
import { Request } from 'express';
import type { AuthenticateOptions } from 'passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthUser } from '../../domain/auth.types';
import {
  buildOAuthState,
  parseOAuthState,
} from '../helpers/oauth-state.helper';

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
    super.authenticate(req, {
      ...options,
      state: buildOAuthState(req),
    });
  }

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): OAuthUser {
    const state = parseOAuthState(req.query.state as string | undefined);

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
