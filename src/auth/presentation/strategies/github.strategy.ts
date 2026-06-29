import { Injectable } from '@nestjs/common';
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

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): OAuthUser {
    const state = parseOAuthState(req.query.state as string | undefined, {
      secret: resolveOAuthStateSecret(this.config),
    });

    return {
      provider: AuthProvider.GITHUB,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName ?? profile.username ?? null,
      avatarUrl: profile.photos?.[0]?.value,
      mode: state.mode,
      platform: state.platform,
      currentUserId: state.currentUserId,
    };
  }
}
