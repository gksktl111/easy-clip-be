import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

const logger = new Logger('HttpLogger');
const MAX_LOG_DEPTH = 3;
const MAX_OBJECT_KEYS = 12;
const MAX_ARRAY_ITEMS = 8;
const MAX_STRING_LENGTH = 160;

type LoggedResponse = {
  body?: unknown;
};

export function registerHttpLoggingMiddleware(
  request: Request,
  response: Response,
  next: () => void,
): void {
  const startedAt = Date.now();
  const traceId = buildTraceId();
  const loggedResponse = patchResponse(response);

  response.on('finish', () => {
    logger.log(
      formatRequestLog(request, response.statusCode, startedAt, {
        traceId,
        responseBody: loggedResponse.body,
      }),
    );
  });

  next();
}

export function isHttpLoggingEnabled(env: NodeJS.ProcessEnv): boolean {
  const override = env.ENABLE_HTTP_LOGGING;

  if (override === 'true') {
    return true;
  }

  if (override === 'false') {
    return false;
  }

  return env.NODE_ENV !== 'production';
}

function patchResponse(response: Response): LoggedResponse {
  const loggedResponse: LoggedResponse = {};
  const originalJson = response.json.bind(response) as (
    body: unknown,
  ) => Response;
  const originalSend = response.send.bind(response) as (
    body?: unknown,
  ) => Response;

  response.json = ((body: unknown) => {
    loggedResponse.body = body;
    return originalJson(body);
  }) as Response['json'];

  response.send = ((body?: unknown) => {
    loggedResponse.body = body;
    return originalSend(body);
  }) as Response['send'];

  return loggedResponse;
}

function formatRequestLog(
  request: Request,
  statusCode: number,
  startedAt: number,
  context: {
    traceId: string;
    responseBody?: unknown;
  },
): string {
  const durationMs = Date.now() - startedAt;
  const lines = [
    [
      colorizeMethod(request.method),
      request.originalUrl || request.url,
      colorizeStatus(statusCode),
      colorizeDuration(durationMs),
      colorizeTraceId(context.traceId),
    ].join(' '),
    `  user: ${extractUserId(request) ?? '-'}`,
  ];

  const query = sanitizeValue(request.query);
  const body = sanitizeValue(request.body);
  const responseBody = sanitizeValue(context.responseBody);

  if (query !== undefined) {
    lines.push(`  query: ${stringifyValue(query)}`);
  }

  if (body !== undefined) {
    lines.push(`  body: ${stringifyValue(body)}`);
  }

  if (responseBody !== undefined) {
    lines.push(`  response: ${stringifyValue(responseBody)}`);
  }

  return lines.join('\n');
}

function extractUserId(request: Request): string | undefined {
  const user = request.user as { userId?: string } | undefined;
  return user?.userId;
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
    const entries = Object.entries(value).filter(
      ([key, currentValue]) =>
        currentValue !== undefined && !isSensitiveKey(key),
    );

    if (!entries.length) {
      return undefined;
    }

    return Object.fromEntries(
      entries
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, currentValue]) => [
          key,
          sanitizeValue(currentValue, depth + 1),
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

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
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
    normalized.includes('secret')
  );
}

function buildTraceId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function colorizeMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return wrapAnsi(method, 36);
    case 'POST':
      return wrapAnsi(method, 32);
    case 'PATCH':
    case 'PUT':
      return wrapAnsi(method, 33);
    case 'DELETE':
      return wrapAnsi(method, 31);
    default:
      return wrapAnsi(method, 35);
  }
}

function colorizeStatus(statusCode: number): string {
  if (statusCode >= 500) {
    return wrapAnsi(String(statusCode), 31);
  }

  if (statusCode >= 400) {
    return wrapAnsi(String(statusCode), 33);
  }

  if (statusCode >= 300) {
    return wrapAnsi(String(statusCode), 36);
  }

  return wrapAnsi(String(statusCode), 32);
}

function colorizeDuration(durationMs: number): string {
  if (durationMs >= 1000) {
    return wrapAnsi(`${durationMs}ms`, 31);
  }

  if (durationMs >= 300) {
    return wrapAnsi(`${durationMs}ms`, 33);
  }

  return wrapAnsi(`${durationMs}ms`, 90);
}

function colorizeTraceId(traceId: string): string {
  return wrapAnsi(`#${traceId}`, 90);
}

function wrapAnsi(value: string, colorCode: number): string {
  return `\u001b[${colorCode}m${value}\u001b[0m`;
}
