import {
  Controller,
  Get,
  INestApplication,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAccessGuard } from '../src/shared/presentation/guards/jwt-access.guard';
import { JwtRefreshGuard } from '../src/auth/presentation/guards/jwt-refresh-token.guard';
import {
  OAuthStateGuard,
  type OAuthStateRequest,
} from '../src/auth/presentation/guards/oauth-state.guard';
import { OAUTH_STATE_STORE } from '../src/auth/application/ports/oauth-state-store.port';
import { ApplicationExceptionFilter } from '../src/shared/presentation/filters/application-exception.filter';
import { assertCookieCsrf } from '../src/shared/presentation/helpers/cookie-csrf.helper';

@Controller('auth')
class SecurityTestController {
  @Post('write')
  @UseGuards(JwtAccessGuard)
  write() {
    return { success: true };
  }
  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  refresh() {
    return { success: true };
  }
  @Post('test/admin-login')
  login(@Req() req: Request) {
    assertCookieCsrf(req, 'any');
    return { success: true };
  }
  @Get('google')
  @UseGuards(OAuthStateGuard)
  start(@Req() req: OAuthStateRequest) {
    return { state: req.oauthState };
  }
  @Get('google/link')
  @UseGuards(JwtAccessGuard, OAuthStateGuard)
  link(@Req() req: OAuthStateRequest) {
    return { state: req.oauthState };
  }
  @Get('google/callback')
  @UseGuards(OAuthStateGuard)
  callback(@Req() req: OAuthStateRequest) {
    return { mode: req.verifiedOAuthState?.mode };
  }
  @Get('github/callback')
  @UseGuards(OAuthStateGuard)
  githubCallback() {
    return { success: true };
  }
}

describe('Browser authentication security (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let access: string;
  let refresh: string;
  const previous = { ...process.env };
  const nonces = new Map<string, Date>();
  const store = {
    issue: jest.fn((id: string, expires: Date) => {
      nonces.set(id, expires);
      return Promise.resolve();
    }),
    consume: jest.fn((id: string, now: Date) => {
      const expires = nonces.get(id);
      if (!expires || expires <= now) return Promise.resolve(false);
      nonces.delete(id);
      return Promise.resolve(true);
    }),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
    delete process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME;
    delete process.env.AUTH_REFRESH_TOKEN_COOKIE_NAME;
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [SecurityTestController],
      providers: [
        JwtAccessGuard,
        JwtRefreshGuard,
        OAuthStateGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_ACCESS_SECRET: 'access-secret',
            JWT_REFRESH_SECRET: 'refresh-secret',
            OAUTH_STATE_SECRET: 'state-secret',
            AUTH_COOKIE_SECURE: 'false',
          }),
        },
        { provide: OAUTH_STATE_STORE, useValue: store },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ApplicationExceptionFilter());
    await app.init();
    jwt = module.get(JwtService);
    access = jwt.sign(
      {
        sub: 'user-1',
        accountId: 'account-1',
        sid: 'session-1',
        platform: 'WEB',
      },
      {
        secret: 'access-secret',
        audience: 'api',
        issuer: 'easy-clip',
        expiresIn: '30m',
      },
    );
    refresh = jwt.sign(
      {
        sub: 'user-1',
        accountId: 'account-1',
        sid: 'session-1',
        platform: 'WEB',
      },
      {
        secret: 'refresh-secret',
        audience: 'refresh',
        issuer: 'easy-clip',
        expiresIn: '1d',
      },
    );
  });
  afterAll(async () => {
    await app.close();
    process.env = previous;
  });
  beforeEach(() => {
    nonces.clear();
    jest.clearAllMocks();
  });

  const server = () => app.getHttpAdapter().getInstance() as App;
  const accessCookie = () => `easy_clip_access_token=${access}`;
  const refreshCookie = () => `easy_clip_refresh_token=${refresh}`;
  const begin = async (link = false) => {
    const result = await request(server())
      .get(link ? '/auth/google/link' : '/auth/google')
      .set('Cookie', link ? accessCookie() : '')
      .expect(200);
    const body = result.body as { state: string };
    const cookies = result.headers['set-cookie'] as unknown as string[];
    return { state: body.state, cookie: cookies[0].split(';')[0] };
  };

  it.each([
    'https://evil.example',
    'null',
    'https://app.example.com/path',
    undefined,
  ])('rejects unsafe cookie requests from %s before writes', async (origin) => {
    const call = request(server())
      .post('/auth/write')
      .set('Cookie', accessCookie())
      .set('x-csrf-protection', '1');
    if (origin) call.set('Origin', origin);
    await call.expect(403);
  });
  it('requires the CSRF custom header and accepts an allowlisted Origin or Referer', async () => {
    await request(server())
      .post('/auth/write')
      .set('Cookie', accessCookie())
      .set('Origin', 'https://app.example.com')
      .expect(403);
    for (const [header, value] of [
      ['Origin', 'https://app.example.com'],
      ['Referer', 'https://app.example.com/favorites'],
    ]) {
      await request(server())
        .post('/auth/write')
        .set('Cookie', accessCookie())
        .set(header, value)
        .set('x-csrf-protection', '1')
        .expect(201);
    }
  });
  it('does not fall back from explicit hostile Origin to trusted Referer', async () => {
    await request(server())
      .post('/auth/write')
      .set('Cookie', accessCookie())
      .set('Origin', 'null')
      .set('Referer', 'https://app.example.com')
      .set('x-csrf-protection', '1')
      .expect(403);
  });
  it('permits bearer apps but never falls back from an invalid bearer to cookie access', async () => {
    await request(server())
      .post('/auth/write')
      .set('Authorization', `Bearer ${access}`)
      .set('Cookie', accessCookie())
      .expect(201);
    await request(server())
      .post('/auth/write')
      .set('Authorization', 'Bearer invalid')
      .set('Cookie', accessCookie())
      .expect(401);
    await request(server())
      .post('/auth/write')
      .set('Authorization', 'Bearer')
      .set('Cookie', accessCookie())
      .expect(403);
  });
  it('refresh follows cookie-first extraction and cannot bypass CSRF with bearer', async () => {
    await request(server())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie())
      .set('Authorization', `Bearer ${refresh}`)
      .expect(403);
    await request(server())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${refresh}`)
      .expect(201);
    await request(server())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie())
      .set('Origin', 'https://app.example.com')
      .set('x-csrf-protection', '1')
      .expect(201);
  });
  it('checks existing browser cookies on test login even if bearer is supplied', async () => {
    await request(server())
      .post('/auth/test/admin-login')
      .set('Cookie', refreshCookie())
      .set('Authorization', 'Bearer ignored')
      .expect(403);
  });
  it('accepts a callback only once from the initiating browser, without Origin/custom header', async () => {
    const start = await begin();
    await request(server())
      .get('/auth/google/callback')
      .query({ state: start.state })
      .expect(400);
    await request(server())
      .get('/auth/google/callback')
      .query({ state: start.state })
      .set('Cookie', start.cookie)
      .expect(200)
      .expect({ mode: 'login' });
    await request(server())
      .get('/auth/google/callback')
      .query({ state: start.state })
      .set('Cookie', start.cookie)
      .expect(400);
  });
  it('rejects another browser and another provider before consuming state', async () => {
    const first = await begin();
    const second = await begin();
    await request(server())
      .get('/auth/google/callback')
      .query({ state: first.state })
      .set('Cookie', second.cookie)
      .expect(400);
    await request(server())
      .get('/auth/github/callback')
      .query({ state: first.state })
      .set('Cookie', first.cookie.replace('google', 'github'))
      .expect(400);
    expect(store.consume).not.toHaveBeenCalled();
  });
  it('rejects expired state before consuming it', async () => {
    const start = await begin();
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000);
    try {
      await request(server())
        .get('/auth/google/callback')
        .query({ state: start.state })
        .set('Cookie', start.cookie)
        .expect(400);
    } finally {
      clock.mockRestore();
    }
    expect(store.consume).not.toHaveBeenCalled();
  });
  it('only one concurrent callback can consume a state', async () => {
    const start = await begin();
    const results = await Promise.all(
      [1, 2].map(() =>
        request(server())
          .get('/auth/google/callback')
          .query({ state: start.state })
          .set('Cookie', start.cookie),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
  });
  it('account linking requires the original user and session at callback', async () => {
    const start = await begin(true);
    await request(server())
      .get('/auth/google/callback')
      .query({ state: start.state })
      .set('Cookie', start.cookie)
      .expect(400);
    for (const claims of [
      { sub: 'user-2', sid: 'session-1' },
      { sub: 'user-1', sid: 'session-2' },
    ]) {
      const changed = jwt.sign(claims, {
        secret: 'access-secret',
        audience: 'api',
        issuer: 'easy-clip',
        expiresIn: '30m',
      });
      await request(server())
        .get('/auth/google/callback')
        .query({ state: start.state })
        .set('Cookie', `${start.cookie}; easy_clip_access_token=${changed}`)
        .expect(400);
    }
    expect(store.consume).not.toHaveBeenCalled();
    await request(server())
      .get('/auth/google/callback')
      .query({ state: start.state })
      .set('Cookie', `${start.cookie}; ${accessCookie()}`)
      .expect(200)
      .expect({ mode: 'link' });
  });
});
