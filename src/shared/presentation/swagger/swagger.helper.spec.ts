import { isSwaggerEnabled } from './swagger.helper';

describe('isSwaggerEnabled', () => {
  it('production에서는 기본적으로 Swagger를 비활성화한다', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('production에서도 ENABLE_SWAGGER가 true면 Swagger를 활성화한다', () => {
    expect(
      isSwaggerEnabled({
        NODE_ENV: 'production',
        ENABLE_SWAGGER: 'true',
      }),
    ).toBe(true);
  });

  it('local에서는 기본적으로 Swagger를 활성화한다', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'local' })).toBe(true);
  });

  it('local에서도 ENABLE_SWAGGER가 false면 Swagger를 비활성화한다', () => {
    expect(
      isSwaggerEnabled({
        NODE_ENV: 'local',
        ENABLE_SWAGGER: 'false',
      }),
    ).toBe(false);
  });
});
