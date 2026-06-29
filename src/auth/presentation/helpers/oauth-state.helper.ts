import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuthContext } from 'src/shared/types/auth-context.type';
import { AuthPlatform } from 'src/shared/types/auth-platform.type';
import { OAuthMode } from '../../domain/auth.types';
import { AuthError } from '../../application/errors/auth.error';

type OAuthStatePayload = {
  platform: AuthPlatform;
  mode: OAuthMode;
  currentUserId?: string;
  expiresAt: number;
};

const DEFAULT_PLATFORM: AuthPlatform = 'WEB';
const DEFAULT_MODE: OAuthMode = 'login';
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const ALLOWED_PLATFORMS = new Set<AuthPlatform>(['WEB', 'APP']);
const ALLOWED_MODES = new Set<OAuthMode>(['login', 'link']);

type OAuthStateOptions = {
  secret: string;
  now?: number;
  ttlMs?: number;
};

export function buildOAuthState(
  req: Request,
  options: OAuthStateOptions,
): string {
  const now = options.now ?? Date.now();
  const payload: OAuthStatePayload = {
    platform: resolvePlatform(req),
    mode: resolveMode(req),
    currentUserId: resolveCurrentUserId(req),
    expiresAt: now + (options.ttlMs ?? DEFAULT_TTL_MS),
  };

  if (payload.mode === 'link' && !payload.currentUserId) {
    throw invalidOAuthState('계정 연결 요청에는 사용자 식별자가 필요합니다.');
  }

  const encodedPayload = encodeJson(payload);
  const signature = sign(encodedPayload, options.secret);

  return `${encodedPayload}.${signature}`;
}

export function parseOAuthState(
  rawState: string | undefined,
  options: OAuthStateOptions,
): OAuthStatePayload {
  if (!rawState) {
    throw invalidOAuthState();
  }

  const stateParts = rawState.split('.');

  if (stateParts.length !== 2) {
    throw invalidOAuthState();
  }

  const [encodedPayload, signature] = stateParts;

  if (!encodedPayload || !signature) {
    throw invalidOAuthState();
  }

  verifySignature(encodedPayload, signature, options.secret);

  const parsed = decodeJson(encodedPayload);
  const platform = normalizePlatform(parsed.platform);
  const mode = normalizeMode(parsed.mode);
  const expiresAt = normalizeExpiresAt(parsed.expiresAt);
  const currentUserId =
    typeof parsed.currentUserId === 'string' ? parsed.currentUserId : undefined;

  if (expiresAt <= (options.now ?? Date.now())) {
    throw invalidOAuthState('OAuth state가 만료되었습니다.');
  }

  if (mode === 'link' && !currentUserId) {
    throw invalidOAuthState('계정 연결 요청에는 사용자 식별자가 필요합니다.');
  }

  return {
    platform,
    mode,
    currentUserId,
    expiresAt,
  };
}

export function resolveOAuthStateSecret(config: {
  get<T = string>(propertyPath: string): T | undefined;
  getOrThrow<T = string>(propertyPath: string): T;
}): string {
  const stateSecret = config.get<string>('OAUTH_STATE_SECRET')?.trim();

  return stateSecret || config.getOrThrow<string>('JWT_ACCESS_SECRET');
}

function resolvePlatform(req: Request): AuthPlatform {
  return normalizePlatform(req.query.platform);
}

function resolveMode(req: Request): OAuthMode {
  const queryMode = req.query.mode;

  if (queryMode) {
    return normalizeMode(queryMode);
  }

  return req.path.endsWith('/link') ? 'link' : DEFAULT_MODE;
}

function resolveCurrentUserId(req: Request): string | undefined {
  const user = req.user as AuthContext | undefined;
  return user?.userId;
}

function encodeJson(value: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson(encoded: string): Partial<OAuthStatePayload> {
  try {
    return JSON.parse(
      Buffer.from(encoded, 'base64url').toString(),
    ) as Partial<OAuthStatePayload>;
  } catch {
    throw invalidOAuthState();
  }
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

function verifySignature(
  encodedPayload: string,
  receivedSignature: string,
  secret: string,
): void {
  const expectedSignature = sign(encodedPayload, secret);
  const expected = Buffer.from(expectedSignature, 'base64url');
  const received = Buffer.from(receivedSignature, 'base64url');

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw invalidOAuthState();
  }
}

function normalizePlatform(platform: unknown): AuthPlatform {
  if (
    typeof platform === 'string' &&
    (ALLOWED_PLATFORMS as Set<string>).has(platform)
  ) {
    return platform as AuthPlatform;
  }

  if (platform == null) {
    return DEFAULT_PLATFORM;
  }

  throw invalidOAuthState('허용되지 않은 OAuth 플랫폼입니다.');
}

function normalizeMode(mode: unknown): OAuthMode {
  if (typeof mode === 'string' && (ALLOWED_MODES as Set<string>).has(mode)) {
    return mode as OAuthMode;
  }

  if (mode == null) {
    return DEFAULT_MODE;
  }

  throw invalidOAuthState('허용되지 않은 OAuth mode입니다.');
}

function normalizeExpiresAt(expiresAt: unknown): number {
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    return expiresAt;
  }

  throw invalidOAuthState();
}

function invalidOAuthState(
  message = '유효하지 않은 OAuth state입니다.',
): AuthError {
  return new AuthError('BAD_REQUEST', message);
}
