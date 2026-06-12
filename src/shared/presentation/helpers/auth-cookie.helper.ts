import type { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

const ACCESS_TOKEN_COOKIE_NAME = 'easy_clip_access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'easy_clip_refresh_token';
const ACCESS_TOKEN_MAX_AGE = 30 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 14 * 24 * 60 * 60 * 1000;

export function setAuthCookies(
  response: Response,
  config: ConfigService,
  session: {
    access_token: string;
    refresh_token: string;
  },
): void {
  response.cookie(
    resolveAccessTokenCookieName(config),
    session.access_token,
    buildCookieOptions(config, ACCESS_TOKEN_MAX_AGE),
  );
  response.cookie(
    resolveRefreshTokenCookieName(config),
    session.refresh_token,
    buildCookieOptions(config, REFRESH_TOKEN_MAX_AGE),
  );
}

export function setAccessTokenCookie(
  response: Response,
  config: ConfigService,
  accessToken: string,
): void {
  response.cookie(
    resolveAccessTokenCookieName(config),
    accessToken,
    buildCookieOptions(config, ACCESS_TOKEN_MAX_AGE),
  );
}

export function clearAuthCookies(
  response: Response,
  config: ConfigService,
): void {
  response.clearCookie(
    resolveAccessTokenCookieName(config),
    buildCookieOptions(config),
  );
  response.clearCookie(
    resolveRefreshTokenCookieName(config),
    buildCookieOptions(config),
  );
}

export function extractAccessToken(request: Request): string | undefined {
  return extractBearerToken(request) ?? extractCookieToken(request, 'access');
}

export function extractRefreshToken(request: Request): string | undefined {
  return extractCookieToken(request, 'refresh') ?? extractBearerToken(request);
}

export function resolveOAuthSuccessRedirectUrl(
  config: ConfigService,
): string {
  const baseUrl = config.getOrThrow<string>('OAUTH_SUCCESS_REDIRECT_BASE_URL');

  return `${trimTrailingSlash(baseUrl)}/favorites`;
}

function extractBearerToken(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}

function extractCookieToken(
  request: Request,
  tokenType: 'access' | 'refresh',
): string | undefined {
  const cookieName =
    tokenType === 'access'
      ? resolveAccessTokenCookieNameFromEnv()
      : resolveRefreshTokenCookieNameFromEnv();

  return parseCookieHeader(request.headers.cookie)[cookieName];
}

function parseCookieHeader(rawCookieHeader?: string): Record<string, string> {
  if (!rawCookieHeader) {
    return {};
  }

  return rawCookieHeader
    .split(';')
    .reduce<Record<string, string>>((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      if (!key) {
        return cookies;
      }

      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function buildCookieOptions(
  config: ConfigService,
  maxAge?: number,
): CookieOptions {
  const secure = isSecureCookie(config);
  const domain = config.get<string>('AUTH_COOKIE_DOMAIN');

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    domain: domain || undefined,
    ...(maxAge ? { maxAge } : {}),
  };
}

function isSecureCookie(config: ConfigService): boolean {
  const override = config.get<string>('AUTH_COOKIE_SECURE');

  if (override === 'true') {
    return true;
  }

  if (override === 'false') {
    return false;
  }

  return config.get<string>('NODE_ENV') === 'production';
}

function resolveAccessTokenCookieName(config: ConfigService): string {
  return (
    config.get<string>('AUTH_ACCESS_TOKEN_COOKIE_NAME') ??
    ACCESS_TOKEN_COOKIE_NAME
  );
}

function resolveRefreshTokenCookieName(config: ConfigService): string {
  return (
    config.get<string>('AUTH_REFRESH_TOKEN_COOKIE_NAME') ??
    REFRESH_TOKEN_COOKIE_NAME
  );
}

function resolveAccessTokenCookieNameFromEnv(): string {
  return process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME ?? ACCESS_TOKEN_COOKIE_NAME;
}

function resolveRefreshTokenCookieNameFromEnv(): string {
  return (
    process.env.AUTH_REFRESH_TOKEN_COOKIE_NAME ?? REFRESH_TOKEN_COOKIE_NAME
  );
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
