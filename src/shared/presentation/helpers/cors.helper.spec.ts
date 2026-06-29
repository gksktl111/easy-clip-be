import {
  createCorsOptions,
  isAllowedCorsOrigin,
  parseAllowedCorsOrigins,
  parseAllowedCorsPorts,
  shouldWarnMissingProductionCorsOrigins,
} from './cors.helper';

describe('cors.helper', () => {
  it('운영 환경에서는 CORS_ALLOWED_ORIGINS의 exact origin만 허용한다', () => {
    const env = {
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS:
        'https://app.easy-clip.app, https://www.easy-clip.app/',
      CORS_ALLOWED_PORTS: '3001',
    };

    expect(isAllowedCorsOrigin('https://app.easy-clip.app', env)).toBe(true);
    expect(isAllowedCorsOrigin('https://www.easy-clip.app', env)).toBe(true);
    expect(isAllowedCorsOrigin('http://localhost:3001', env)).toBe(false);
    expect(isAllowedCorsOrigin('https://evil.example.com', env)).toBe(false);
  });

  it('local 환경에서는 허용된 localhost/127.0.0.1 포트를 허용한다', () => {
    const env = {
      NODE_ENV: 'local',
      CORS_ALLOWED_PORTS: '3000,3001,5173',
    };

    expect(isAllowedCorsOrigin('http://localhost:3001', env)).toBe(true);
    expect(isAllowedCorsOrigin('http://127.0.0.1:5173', env)).toBe(true);
    expect(isAllowedCorsOrigin('http://localhost:9999', env)).toBe(false);
    expect(isAllowedCorsOrigin('https://app.easy-clip.app', env)).toBe(false);
  });

  it('local 환경에서도 CORS_ALLOWED_ORIGINS에 포함된 배포 origin은 허용한다', () => {
    const env = {
      NODE_ENV: 'local',
      CORS_ALLOWED_ORIGINS: 'https://preview.easy-clip.app',
      CORS_ALLOWED_PORTS: '3001',
    };

    expect(isAllowedCorsOrigin('https://preview.easy-clip.app', env)).toBe(
      true,
    );
  });

  it('Origin이 없는 요청은 CorsOptions에서 허용한다', () => {
    const corsOptions = createCorsOptions({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://app.easy-clip.app',
    });
    const callback = jest.fn();

    if (typeof corsOptions.origin !== 'function') {
      throw new Error('origin callback이 필요합니다.');
    }

    corsOptions.origin(undefined, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('운영 allowlist가 비어 있으면 warning 대상이다', () => {
    expect(
      shouldWarnMissingProductionCorsOrigins({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: '',
      }),
    ).toBe(true);
    expect(
      shouldWarnMissingProductionCorsOrigins({
        NODE_ENV: 'local',
        CORS_ALLOWED_ORIGINS: '',
      }),
    ).toBe(false);
  });

  it('origin과 port 목록은 공백과 trailing slash를 정규화한다', () => {
    expect(
      parseAllowedCorsOrigins(' https://app.easy-clip.app/ , invalid-origin '),
    ).toEqual(new Set(['https://app.easy-clip.app']));
    expect(parseAllowedCorsPorts(' 3000, 5173 ,, ')).toEqual(
      new Set(['3000', '5173']),
    );
  });
});
