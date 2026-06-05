import type { Request } from 'express';
import { AuthContext } from 'src/common/types/auth-context.type';
import { AuthPlatform } from 'src/common/types/auth-platform.type';
import { OAuthMode } from '../../domain/auth.types';

type OAuthStatePayload = {
  platform: AuthPlatform;
  mode: OAuthMode;
  currentUserId?: string;
};

const DEFAULT_PLATFORM: AuthPlatform = 'WEB';
const DEFAULT_MODE: OAuthMode = 'login';

export function buildOAuthState(req: Request): string {
  const payload: OAuthStatePayload = {
    platform: resolvePlatform(req),
    mode: resolveMode(req),
    currentUserId: resolveCurrentUserId(req),
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function parseOAuthState(rawState?: string): OAuthStatePayload {
  if (!rawState) {
    return {
      platform: DEFAULT_PLATFORM,
      mode: DEFAULT_MODE,
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(rawState, 'base64').toString(),
    ) as Partial<OAuthStatePayload>;

    return {
      platform: parsed.platform ?? DEFAULT_PLATFORM,
      mode: parsed.mode ?? DEFAULT_MODE,
      currentUserId: parsed.currentUserId,
    };
  } catch {
    return {
      platform: DEFAULT_PLATFORM,
      mode: DEFAULT_MODE,
    };
  }
}

function resolvePlatform(req: Request): AuthPlatform {
  return (req.query.platform as AuthPlatform | undefined) ?? DEFAULT_PLATFORM;
}

function resolveMode(req: Request): OAuthMode {
  const queryMode = req.query.mode as OAuthMode | undefined;

  if (queryMode) {
    return queryMode;
  }

  return req.path.endsWith('/link') ? 'link' : DEFAULT_MODE;
}

function resolveCurrentUserId(req: Request): string | undefined {
  const user = req.user as AuthContext | undefined;
  return user?.userId;
}
