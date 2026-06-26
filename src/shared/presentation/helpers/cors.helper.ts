import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export type CorsEnvironment = Record<string, string | undefined> & {
  NODE_ENV?: string;
  CORS_ALLOWED_ORIGINS?: string;
  CORS_ALLOWED_PORTS?: string;
};

export function createCorsOptions(env: CorsEnvironment): CorsOptions {
  return {
    origin(origin, callback) {
      // 브라우저가 아닌 서버 간 요청/헬스체크는 Origin 헤더가 없을 수 있다.
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, isAllowedCorsOrigin(origin, env));
    },
    credentials: true,
  };
}

export function isAllowedCorsOrigin(
  origin: string,
  env: CorsEnvironment,
): boolean {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  const allowedOrigins = parseAllowedCorsOrigins(env.CORS_ALLOWED_ORIGINS);

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  if (env.NODE_ENV === 'production') {
    return false;
  }

  return isAllowedLocalDevelopmentOrigin(
    normalizedOrigin,
    parseAllowedCorsPorts(env.CORS_ALLOWED_PORTS),
  );
}

export function shouldWarnMissingProductionCorsOrigins(
  env: CorsEnvironment,
): boolean {
  return (
    env.NODE_ENV === 'production' &&
    parseAllowedCorsOrigins(env.CORS_ALLOWED_ORIGINS).size === 0
  );
}

export function parseAllowedCorsOrigins(raw?: string): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((value) => normalizeOrigin(value.trim()))
      .filter((value): value is string => Boolean(value)),
  );
}

export function parseAllowedCorsPorts(raw?: string): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isAllowedLocalDevelopmentOrigin(
  origin: string,
  allowedPorts: Set<string>,
): boolean {
  const url = new URL(origin);
  const isLocalHost =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (!isLocalHost) {
    return false;
  }

  return allowedPorts.has(url.port);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
