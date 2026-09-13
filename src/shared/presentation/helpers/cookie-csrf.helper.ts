import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { extractBearerToken, extractCookieToken } from './auth-cookie.helper';
import { isAllowedCorsOrigin } from './cors.helper';

export function assertCookieCsrf(
  request: Request,
  tokenType: 'access' | 'refresh' | 'any' = 'access',
): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  // Match the actual authentication extractor: access prefers Bearer, refresh cookies.
  if (tokenType === 'access' && extractBearerToken(request)) return;
  const hasCookie =
    tokenType === 'any'
      ? extractCookieToken(request, 'access') ||
        extractCookieToken(request, 'refresh')
      : extractCookieToken(request, tokenType);
  if (!hasCookie) return;

  const origin = request.get('origin');
  const referer = request.get('referer');
  let source: string | undefined;
  try {
    // An explicit invalid Origin must never fall back to Referer.
    const url = new URL(origin ?? referer ?? '');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error('Invalid source');
    }
    if (origin !== undefined && origin !== url.origin)
      throw new Error('Invalid origin');
    source = url.origin;
  } catch {
    throw new ForbiddenException('쿠키 인증 요청의 출처를 확인할 수 없습니다.');
  }
  if (
    !isAllowedCorsOrigin(source, process.env) ||
    request.get('x-csrf-protection') !== '1'
  ) {
    throw new ForbiddenException('허용되지 않은 쿠키 인증 요청입니다.');
  }
}
