import type { DatabaseQueryMetricLabels } from './prometheus-metrics.service';

const OPERATION_PATTERN = /^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i;
const TABLE_PATTERN =
  /\b(?:FROM|INTO|UPDATE)\s+(?:"[^"]+"\.)?"([A-Za-z][A-Za-z0-9_]*)"/i;

/**
 * Prisma query events include raw SQL and parameter values. Prometheus labels
 * must remain bounded, so only the SQL operation and static table/model name
 * are kept for aggregation.
 */
export function resolvePrismaQueryMetricLabels(
  query: string,
): DatabaseQueryMetricLabels {
  const operation =
    OPERATION_PATTERN.exec(query)?.[1]?.toLowerCase() ?? 'other';
  const model = TABLE_PATTERN.exec(query)?.[1] ?? 'unknown';

  return { operation, model };
}
