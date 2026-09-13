const REDACTED_LOG_VALUE = '[REDACTED]';
const MAX_LOG_DEPTH = 3;
const MAX_OBJECT_KEYS = 12;
const MAX_ARRAY_ITEMS = 8;
const MAX_STRING_LENGTH = 160;

export function sanitizeRequestUrl(value: unknown): unknown {
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
    return '[Invalid URL]';
  }
}

export function sanitizeValue(value: unknown, depth = 0): unknown {
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
    normalized === 'authkey' ||
    normalized === 'billingkey' ||
    normalized.includes('token') ||
    normalized.includes('code') ||
    normalized.includes('password') ||
    normalized.includes('authorization') ||
    normalized.includes('cookie') ||
    normalized.includes('secret') ||
    normalized.includes('state')
  );
}

export function sanitizeLogError(error: unknown): unknown {
  if (!(error instanceof Error) && !isPlainObject(error)) {
    return sanitizeValue(error);
  }
  // Pino may pass a serialized error. Whitelist diagnostic fields so custom
  // properties, raw errors and nested causes cannot bypass sanitization.
  const type = error instanceof Error ? error.name : error.type;
  return {
    type: typeof type === 'string' ? sanitizeLogText(type) : 'Error',
    message:
      typeof error.message === 'string'
        ? sanitizeLogText(error.message)
        : undefined,
    stack:
      typeof error.stack === 'string'
        ? sanitizeLogText(error.stack)
        : undefined,
  };
}

export function sanitizeLogText(value: unknown): unknown {
  if (typeof value !== 'string') return sanitizeValue(value);
  return value.replace(
    /([?&])([^=\s&]+)=([^&\s]*)/g,
    (match: string, separator: string, key: string) => {
      let decoded: string;
      try {
        decoded = decodeURIComponent(key);
      } catch {
        return `${separator}${key}=[REDACTED]`;
      }
      return isSensitiveKey(decoded) ? `${separator}${key}=[REDACTED]` : match;
    },
  );
}
