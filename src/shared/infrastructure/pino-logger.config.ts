import { randomUUID } from 'node:crypto';
import type { Options } from 'pino-http';
import {
  sanitizeRequestUrl,
  sanitizeValue,
  sanitizeLogError,
  sanitizeLogText,
} from '../application/helpers/log-sanitization.helper';

const REDACTED_LOG_VALUE = '[REDACTED]';
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
    autoLogging: isHttpLoggingEnabled(env)
      ? {
          ignore: (request) => isMetricsRequest(request.url),
        }
      : false,
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
      err: sanitizeLogError,
      msg: sanitizeLogText,
      path: sanitizeRequestUrl,
      req: (request: Record<string, unknown>) => ({
        ...request,
        headers: sanitizeValue(request.headers),
        query: sanitizeValue(request.query),
        url: sanitizeRequestUrl(request.url),
        originalUrl: sanitizeRequestUrl(request.originalUrl),
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

function isMetricsRequest(url: string | undefined): boolean {
  return url === '/metrics' || url?.startsWith('/metrics?') === true;
}

function resolveRequestId(value: string | string[] | undefined): string {
  const requestId = Array.isArray(value) ? value[0] : value;

  if (requestId && REQUEST_ID_PATTERN.test(requestId)) {
    return requestId;
  }

  return randomUUID();
}
