import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../src/auth/presentation/auth.controller';
import { GoogleStrategy } from '../src/auth/presentation/strategies/google.strategy';
import { GithubStrategy } from '../src/auth/presentation/strategies/github.strategy';
import { OAuthStateGuard } from '../src/auth/presentation/guards/oauth-state.guard';
import { OAUTH_STATE_STORE } from '../src/auth/application/ports/oauth-state-store.port';
import { SignInUseCase } from '../src/auth/application/usecases/sign-in.usecase';
import { LinkAccountUseCase } from '../src/auth/application/usecases/link-account.usecase';
import { SwitchUserUseCase } from '../src/auth/application/usecases/switch-user.usecase';
import { RefreshAccessTokenUseCase } from '../src/auth/application/usecases/refresh-access-token.usecase';
import { LogoutUseCase } from '../src/auth/application/usecases/logout.usecase';
import { TestAdminLoginUseCase } from '../src/auth/application/usecases/test-admin-login.usecase';

type ProviderAdapter = {
  _oauth2: {
    getOAuthAccessToken(
      code: string,
      options: unknown,
      done: (
        err: null,
        access: string,
        refresh: string,
        params: object,
      ) => void,
    ): void;
  };
  userProfile(access: string, done: (err: null, profile: object) => void): void;
};

describe('OAuth Passport callback integration (e2e)', () => {
  let app: INestApplication<App>;
  const nonces = new Set<string>();
  const session = {
    access_token: 'issued-access',
    refresh_token: 'issued-refresh',
    user: { id: 'user-1', displayName: 'User', avatarUrl: null },
  };
  const signIn = { execute: jest.fn().mockResolvedValue(session) };
  const exchanges: jest.SpyInstance[] = [];
  let fetchMock: jest.SpyInstance;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({}),
        PassportModule.register({ session: false }),
      ],
      controllers: [AuthController],
      providers: [
        GoogleStrategy,
        GithubStrategy,
        OAuthStateGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            GOOGLE_CLIENT_ID: 'test-google',
            GOOGLE_CLIENT_SECRET: 'test-secret',
            GOOGLE_REDIRECT_URI: 'http://localhost/auth/google/callback',
            GITHUB_CLIENT_ID: 'test-github',
            GITHUB_CLIENT_SECRET: 'test-secret',
            GITHUB_REDIRECT_URI: 'http://localhost/auth/github/callback',
            JWT_ACCESS_SECRET: 'test-access-secret',
            OAUTH_STATE_SECRET: 'test-state-secret',
            AUTH_COOKIE_SECURE: 'false',
            OAUTH_SUCCESS_REDIRECT_BASE_URL: 'https://app.example.com',
          }),
        },
        {
          provide: OAUTH_STATE_STORE,
          useValue: {
            issue: (id: string) => {
              nonces.add(id);
              return Promise.resolve();
            },
            consume: (id: string) => Promise.resolve(nonces.delete(id)),
          },
        },
        { provide: SignInUseCase, useValue: signIn },
        ...[
          LinkAccountUseCase,
          SwitchUserUseCase,
          RefreshAccessTokenUseCase,
          LogoutUseCase,
          TestAdminLoginUseCase,
        ].map((provide) => ({ provide, useValue: { execute: jest.fn() } })),
      ],
    }).compile();
    for (const strategy of [
      module.get(GoogleStrategy),
      module.get(GithubStrategy),
    ]) {
      const adapter = strategy as unknown as ProviderAdapter;
      exchanges.push(
        jest
          .spyOn(adapter._oauth2, 'getOAuthAccessToken')
          .mockImplementation((_code, _options, done) =>
            done(null, 'provider-access', 'provider-refresh', {}),
          ),
      );
      jest.spyOn(adapter, 'userProfile').mockImplementation((_access, done) =>
        done(null, {
          id: 'provider-user',
          displayName: 'User',
          emails: [{ value: 'user@example.com' }],
          photos: [],
        }),
      );
    }
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { email: 'user@example.com', primary: true, verified: true },
          ]),
          { status: 200 },
        ),
      );
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  beforeEach(() => {
    nonces.clear();
    signIn.execute.mockClear();
    exchanges.forEach((spy) => spy.mockClear());
  });
  afterAll(async () => {
    await app.close();
    fetchMock.mockRestore();
  });

  it.each(['google', 'github'])(
    '%s exchanges only a browser-bound unused state and sets auth cookies',
    async (provider) => {
      const server = app.getHttpAdapter().getInstance() as App;
      const start = await request(server).get(`/auth/${provider}`).expect(302);
      const location = start.headers.location;
      const state = new URL(location).searchParams.get('state');
      expect(state).toBeTruthy();
      const cookies = start.headers['set-cookie'] as unknown as string[];
      const browserCookie = cookies[0].split(';')[0];
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('SameSite=Lax');
      expect(cookies[0]).not.toContain('Domain=');
      await request(server)
        .get(`/auth/${provider}/callback`)
        .query({ code: 'provider-code', state })
        .expect(400);
      expect(exchanges.every((spy) => spy.mock.calls.length === 0)).toBe(true);
      const result = await request(server)
        .get(`/auth/${provider}/callback`)
        .query({ code: 'provider-code', state })
        .set('Cookie', browserCookie)
        .expect(302);
      expect(result.headers.location).toBe('https://app.example.com/favorites');
      expect(result.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('easy_clip_access_token=issued-access'),
          expect.stringContaining('easy_clip_refresh_token=issued-refresh'),
        ]),
      );
      expect(signIn.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: provider.toUpperCase(),
          mode: 'login',
          platform: 'WEB',
        }),
        expect.any(Object),
      );
      await request(server)
        .get(`/auth/${provider}/callback`)
        .query({ code: 'provider-code', state })
        .set('Cookie', browserCookie)
        .expect(400);
      expect(
        exchanges.reduce((total, spy) => total + spy.mock.calls.length, 0),
      ).toBe(1);
      expect(signIn.execute).toHaveBeenCalledTimes(1);
    },
  );
});
