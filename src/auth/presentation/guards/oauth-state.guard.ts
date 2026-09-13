import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import {
  extractAccessToken,
  isSecureCookie,
  parseCookieHeader,
} from 'src/shared/presentation/helpers/auth-cookie.helper';
import { AuthContext } from 'src/shared/types/auth-context.type';
import {
  OAUTH_STATE_STORE,
  type OAuthStateStore,
} from '../../application/ports/oauth-state-store.port';
import {
  buildOAuthState,
  OAuthStatePayload,
  parseOAuthState,
  resolveOAuthStateSecret,
} from '../helpers/oauth-state.helper';

export type OAuthStateRequest = Request & {
  oauthState?: string;
  verifiedOAuthState?: OAuthStatePayload;
};

@Injectable()
export class OAuthStateGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @Inject(OAUTH_STATE_STORE) private readonly store: OAuthStateStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OAuthStateRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const provider = request.path.split('/')[2];
    if (!['google', 'github'].includes(provider))
      throw new BadRequestException('유효하지 않은 OAuth 제공자입니다.');
    const secret = resolveOAuthStateSecret(this.config);
    const secure = isSecureCookie(this.config);
    const cookieName = `${secure ? '__Host-' : ''}easy_clip_oauth_${provider}`;
    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
    };

    if (!request.path.endsWith('/callback')) {
      const browserNonce = randomBytes(32).toString('base64url');
      const nonce = randomBytes(32).toString('base64url');
      const user = request.user as AuthContext | undefined;
      const state = buildOAuthState(request, {
        secret,
        binding: {
          nonce,
          browserHash: hash(browserNonce),
          provider,
          sessionId: user?.sessionId,
        },
      });
      const payload = parseOAuthState(state, { secret });
      if (payload.mode === 'link' && !payload.sessionId) throw invalidState();
      await this.store.issue(nonce, new Date(payload.expiresAt));
      response.cookie(cookieName, browserNonce, {
        ...cookieOptions,
        maxAge: payload.expiresAt - Date.now(),
      });
      request.oauthState = state;
      return true;
    }

    const rawState = request.query.state;
    if (typeof rawState !== 'string') throw invalidState();
    const state = parseOAuthState(rawState, { secret });
    const browserNonce = parseCookieHeader(request.headers.cookie)[cookieName];
    if (
      !state.nonce ||
      state.provider !== provider ||
      !browserNonce ||
      state.browserHash !== hash(browserNonce)
    )
      throw invalidState();

    if (state.mode === 'link') {
      const token = extractAccessToken(request);
      if (!token || !state.sessionId) throw invalidState();
      try {
        const session = await this.jwt.verifyAsync<{
          sub: string;
          sid?: string;
        }>(token, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          audience: 'api',
          issuer: 'easy-clip',
        });
        if (
          session.sub !== state.currentUserId ||
          session.sid !== state.sessionId
        )
          throw invalidState();
      } catch {
        throw invalidState();
      }
    }

    // DELETE with the nonce PK is atomic even for concurrent callbacks/API replicas.
    if (!(await this.store.consume(state.nonce, new Date())))
      throw invalidState();
    response.clearCookie(cookieName, cookieOptions);
    request.verifiedOAuthState = state;
    return true;
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function invalidState(): BadRequestException {
  return new BadRequestException(
    '유효하지 않거나 이미 사용된 OAuth state입니다.',
  );
}
