import { resolvePrismaQueryMetricLabels } from './prisma-query-metrics.helper';

describe('resolvePrismaQueryMetricLabels', () => {
  it.each([
    [
      'SELECT "public"."Clip"."id" FROM "public"."Clip" WHERE "public"."Clip"."id" = $1',
      { operation: 'select', model: 'Clip' },
    ],
    [
      'INSERT INTO "public"."Folder" ("id") VALUES ($1)',
      { operation: 'insert', model: 'Folder' },
    ],
    [
      'UPDATE "public"."UserSettings" SET "theme" = $1 WHERE "id" = $2',
      { operation: 'update', model: 'UserSettings' },
    ],
    [
      'DELETE FROM "public"."RefreshToken" WHERE "id" = $1',
      { operation: 'delete', model: 'RefreshToken' },
    ],
    ['BEGIN', { operation: 'other', model: 'unknown' }],
  ])('normalizes %s without using raw SQL as a label', (query, expected) => {
    expect(resolvePrismaQueryMetricLabels(query)).toEqual(expected);
  });
});
