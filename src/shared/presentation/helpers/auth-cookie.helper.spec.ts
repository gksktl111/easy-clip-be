import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import {
  clearAuthCookies,
  extractAccessToken,
  extractRefreshToken,
  resolveOAuthSuccessRedirectUrl,
  setAccessTokenCookie,
  setAuthCookies,
} from './auth-cookie.helper';

describe('auth-cookie helper', () => {
  const createConfigService = (values: Record<string, string>) =>
    new ConfigService(values);

  it('access token은 헤더의 Bearer 토큰을 우선 사용한다', () => {
    const request = {
      headers: {
        authorization: 'Bearer access-from-header',
        cookie:
          'easy_clip_access_token=access-from-cookie; easy_clip_refresh_token=refresh-from-cookie',
      },
    } as Request;

    expect(extractAccessToken(request)).toBe('access-from-header');
  });

  it('refresh token은 쿠키를 우선 사용한다', () => {
    const request = {
      headers: {
        authorization: 'Bearer refresh-from-header',
        cookie:
          'easy_clip_access_token=access-from-cookie; easy_clip_refresh_token=refresh-from-cookie',
      },
    } as Request;

    expect(extractRefreshToken(request)).toBe('refresh-from-cookie');
  });

  it('Authorization 헤더가 없으면 쿠키에서 access/refresh 토큰을 읽는다', () => {
    const request = {
      headers: {
        cookie:
          'easy_clip_access_token=access-from-cookie; easy_clip_refresh_token=refresh-from-cookie',
      },
    } as Request;

    expect(extractAccessToken(request)).toBe('access-from-cookie');
    expect(extractRefreshToken(request)).toBe('refresh-from-cookie');
  });

  it('쿠키 이름과 secure 옵션을 반영해 인증 쿠키를 저장한다', () => {
    const cookie = jest.fn();
    const response = {
      cookie,
    } as unknown as Response;
    const config = createConfigService({
      AUTH_ACCESS_TOKEN_COOKIE_NAME: 'access_cookie',
      AUTH_REFRESH_TOKEN_COOKIE_NAME: 'refresh_cookie',
      AUTH_COOKIE_SECURE: 'true',
    });

    setAuthCookies(response, config, {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-id',
        displayName: '사용자',
        avatarUrl: null,
      },
    });

    expect(cookie).toHaveBeenNthCalledWith(
      1,
      'access_cookie',
      'access-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }),
    );
    expect(cookie).toHaveBeenNthCalledWith(
      2,
      'refresh_cookie',
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }),
    );
  });

  it('access token만 갱신하는 쿠키를 저장한다', () => {
    const cookie = jest.fn();
    const response = {
      cookie,
    } as unknown as Response;
    const config = createConfigService({});

    setAccessTokenCookie(response, config, 'renewed-access-token');

    expect(cookie).toHaveBeenCalledWith(
      'easy_clip_access_token',
      'renewed-access-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      }),
    );
  });

  it('인증 쿠키를 삭제한다', () => {
    const clearCookie = jest.fn();
    const response = {
      clearCookie,
    } as unknown as Response;
    const config = createConfigService({
      AUTH_ACCESS_TOKEN_COOKIE_NAME: 'access_cookie',
      AUTH_REFRESH_TOKEN_COOKIE_NAME: 'refresh_cookie',
    });

    clearAuthCookies(response, config);

    expect(clearCookie).toHaveBeenNthCalledWith(
      1,
      'access_cookie',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(clearCookie).toHaveBeenNthCalledWith(
      2,
      'refresh_cookie',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
  });

  it('OAuth 성공 리다이렉트 URL을 mode 기준으로 고른다', () => {
    const config = createConfigService({
      OAUTH_SUCCESS_REDIRECT_BASE_URL: 'http://localhost:3001/',
    });

    expect(resolveOAuthSuccessRedirectUrl(config, 'user-id')).toBe(
      'http://localhost:3001/user-id/favorites',
    );
  });
});
