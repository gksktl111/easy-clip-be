import type { Request } from 'express';
import {
  buildOAuthState,
  parseOAuthState,
  resolveOAuthStateSecret,
} from './oauth-state.helper';

const SECRET = 'test-oauth-state-secret';
const NOW = new Date('2026-06-26T00:00:00.000Z').getTime();

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    path: '/auth/google',
    query: {},
    ...overrides,
  }) as Request;

const decodePayload = (state: string): Record<string, unknown> => {
  const [encodedPayload] = state.split('.');

  return JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString(),
  ) as Record<string, unknown>;
};

const encodePayload = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

const expectBadRequest = (callback: () => unknown): void => {
  try {
    callback();
    throw new Error('BAD_REQUEST 오류가 발생해야 합니다.');
  } catch (error) {
    expect(error).toMatchObject({ code: 'BAD_REQUEST' });
  }
};

describe('oauth-state.helper', () => {
  it('서명된 OAuth state를 생성하고 다시 검증한다', () => {
    const state = buildOAuthState(
      createRequest({
        path: '/auth/github/link',
        query: { platform: 'APP' },
        user: { userId: 'user-id' },
      } as Partial<Request>),
      { secret: SECRET, now: NOW },
    );

    const parsed = parseOAuthState(state, { secret: SECRET, now: NOW });

    expect(parsed).toEqual({
      platform: 'APP',
      mode: 'link',
      currentUserId: 'user-id',
      expiresAt: NOW + 10 * 60 * 1000,
    });
  });

  it('payload가 변조되면 BAD_REQUEST 오류를 반환한다', () => {
    const state = buildOAuthState(createRequest(), {
      secret: SECRET,
      now: NOW,
    });
    const [, signature] = state.split('.');
    const tamperedPayload = {
      ...decodePayload(state),
      mode: 'link',
      currentUserId: 'victim-user-id',
    };
    const tamperedState = `${encodePayload(tamperedPayload)}.${signature}`;

    expectBadRequest(() =>
      parseOAuthState(tamperedState, { secret: SECRET, now: NOW }),
    );
  });

  it('signature가 변조되면 BAD_REQUEST 오류를 반환한다', () => {
    const state = buildOAuthState(createRequest(), {
      secret: SECRET,
      now: NOW,
    });
    const [payload] = state.split('.');

    expectBadRequest(() =>
      parseOAuthState(`${payload}.invalid-signature`, {
        secret: SECRET,
        now: NOW,
      }),
    );
  });

  it('legacy base64 state처럼 서명 없는 형식은 거부한다', () => {
    const legacyState = Buffer.from(
      JSON.stringify({ platform: 'WEB', mode: 'login' }),
    ).toString('base64');

    expectBadRequest(() =>
      parseOAuthState(legacyState, { secret: SECRET, now: NOW }),
    );
  });

  it('만료된 state는 BAD_REQUEST 오류를 반환한다', () => {
    const state = buildOAuthState(createRequest(), {
      secret: SECRET,
      now: NOW,
      ttlMs: 1000,
    });

    expectBadRequest(() =>
      parseOAuthState(state, { secret: SECRET, now: NOW + 1000 }),
    );
  });

  it('허용되지 않은 platform이나 mode는 state 생성 단계에서 거부한다', () => {
    expectBadRequest(() =>
      buildOAuthState(createRequest({ query: { platform: 'DESKTOP' } }), {
        secret: SECRET,
        now: NOW,
      }),
    );

    expectBadRequest(() =>
      buildOAuthState(createRequest({ query: { mode: 'connect' } }), {
        secret: SECRET,
        now: NOW,
      }),
    );
  });

  it('계정 연결 state에는 생성 시점부터 사용자 식별자가 필요하다', () => {
    expectBadRequest(() =>
      buildOAuthState(
        createRequest({
          path: '/auth/google',
          query: { mode: 'link' },
        }),
        { secret: SECRET, now: NOW },
      ),
    );
  });

  it('OAUTH_STATE_SECRET이 있으면 우선 사용하고 없으면 JWT_ACCESS_SECRET을 사용한다', () => {
    expect(
      resolveOAuthStateSecret({
        get: jest.fn().mockReturnValue('state-secret'),
        getOrThrow: jest.fn().mockReturnValue('access-secret'),
      }),
    ).toBe('state-secret');

    expect(
      resolveOAuthStateSecret({
        get: jest.fn().mockReturnValue(''),
        getOrThrow: jest.fn().mockReturnValue('access-secret'),
      }),
    ).toBe('access-secret');
  });
});
