import { randomUUID } from 'node:crypto';
import type { Options } from 'pino-http';

const REDACTED_LOG_VALUE = '[REDACTED]';
const MAX_LOG_DEPTH = 3;
const MAX_OBJECT_KEYS = 12;
const MAX_ARRAY_ITEMS = 8;
const MAX_STRING_LENGTH = 160;
const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

const SENSITIVE_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["proxy-authorization"]',
  'req.headers["x-test-admin-secret"]',
  'req.headers["x-auto-renewals-secret"]',
  'res.headers["set-cookie"]',
] as const;

export function createPinoHttpOptions(env: NodeJS.ProcessEnv): Options {
  return {
    autoLogging: isHttpLoggingEnabled(env),
    genReqId: (request, response) => {
      const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);

      response.setHeader(REQUEST_ID_HEADER, requestId);

      return requestId;
    },
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: {
      paths: [...SENSITIVE_LOG_PATHS],
      censor: REDACTED_LOG_VALUE,
    },
    serializers: {
      req: (request: Record<string, unknown>) => ({
        ...request,
        headers: sanitizeValue(request.headers),
        query: sanitizeValue(request.query),
        url: sanitizeRequestUrl(request.url),
      }),
      res: (response: Record<string, unknown>) => ({
        ...response,
        headers: sanitizeValue(response.headers),
      }),
    },
    customLogLevel: (_request, response, error) => {
      if (error || response.statusCode >= 500) {
        return 'error';
      }

      if (response.statusCode >= 400) {
        return 'warn';
      }

      return 'info';
    },
    customSuccessMessage: (_request, response) =>
      response.statusCode >= 400
        ? 'HTTP 요청 처리 실패'
        : 'HTTP 요청 처리 완료',
    customErrorMessage: () => 'HTTP 요청 처리 실패',
  };
}

function isHttpLoggingEnabled(env: NodeJS.ProcessEnv): boolean {
  const override = env.ENABLE_HTTP_LOGGING;

  if (override === 'true') {
    return true;
  }

  if (override === 'false') {
    return false;
  }

  return env.NODE_ENV !== 'production';
}

function resolveRequestId(value: string | string[] | undefined): string {
  const requestId = Array.isArray(value) ? value[0] : value;

  if (requestId && REQUEST_ID_PATTERN.test(requestId)) {
    return requestId;
  }

  return randomUUID();
}

function sanitizeRequestUrl(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    const url = new URL(value, 'http://localhost');

    for (const key of new Set(url.searchParams.keys())) {
      if (isSensitiveKey(key)) {
        url.searchParams.set(key, REDACTED_LOG_VALUE);
      }
    }

    return truncateString(`${url.pathname}${url.search}`);
  } catch {
    return truncateString(value);
  }
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (depth >= MAX_LOG_DEPTH) {
    return '[Truncated]';
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer:${value.length}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, currentValue]) => currentValue !== undefined)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, currentValue]) => [
          key,
          isSensitiveKey(key)
            ? REDACTED_LOG_VALUE
            : sanitizeValue(currentValue, depth + 1),
        ]),
    );
  }

  if (typeof value === 'function') {
    return `[Function:${value.name || 'anonymous'}]`;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  return '[Unsupported]';
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return (
    normalized.includes('token') ||
    normalized.includes('code') ||
    normalized.includes('password') ||
    normalized.includes('authorization') ||
    normalized.includes('cookie') ||
    normalized.includes('secret') ||
    normalized.includes('state')
  );
}
