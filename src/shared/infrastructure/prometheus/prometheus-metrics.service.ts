import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
  type RegistryContentType,
} from 'prom-client';

const METRIC_PREFIX = 'easy_clip_';
const HTTP_RESPONSE_LABEL_NAMES = ['method', 'route', 'status_code'] as const;
const HTTP_IN_PROGRESS_LABEL_NAMES = ['method', 'route'] as const;
const DATABASE_QUERY_LABEL_NAMES = ['operation', 'model'] as const;
const HTTP_DURATION_BUCKETS_IN_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];
const DATABASE_QUERY_DURATION_BUCKETS_IN_SECONDS = [
  0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
];

type HttpResponseLabelName = (typeof HTTP_RESPONSE_LABEL_NAMES)[number];
type HttpInProgressLabelName = (typeof HTTP_IN_PROGRESS_LABEL_NAMES)[number];
type DatabaseQueryLabelName = (typeof DATABASE_QUERY_LABEL_NAMES)[number];

export interface HttpRequestMetricLabels {
  method: string;
  route: string;
}

export interface HttpResponseMetricLabels extends HttpRequestMetricLabels {
  statusCode: number;
}

export interface DatabaseQueryMetricLabels {
  operation: string;
  model: string;
}

@Injectable()
export class PrometheusMetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<HttpResponseLabelName>;
  private readonly httpRequestDurationSeconds: Histogram<HttpResponseLabelName>;
  private readonly httpRequestsInProgress: Gauge<HttpInProgressLabelName>;
  private readonly databaseQueriesTotal: Counter<DatabaseQueryLabelName>;
  private readonly databaseQueryDurationSeconds: Histogram<DatabaseQueryLabelName>;

  constructor() {
    collectDefaultMetrics({
      prefix: METRIC_PREFIX,
      register: this.registry,
    });

    this.httpRequestsTotal = new Counter({
      name: `${METRIC_PREFIX}http_requests_total`,
      help: 'Total number of HTTP requests handled by the API.',
      labelNames: HTTP_RESPONSE_LABEL_NAMES,
      registers: [this.registry],
    });
    this.httpRequestDurationSeconds = new Histogram({
      name: `${METRIC_PREFIX}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds.',
      labelNames: HTTP_RESPONSE_LABEL_NAMES,
      buckets: HTTP_DURATION_BUCKETS_IN_SECONDS,
      registers: [this.registry],
    });
    this.httpRequestsInProgress = new Gauge({
      name: `${METRIC_PREFIX}http_requests_in_progress`,
      help: 'Number of HTTP requests currently being handled by the API.',
      labelNames: HTTP_IN_PROGRESS_LABEL_NAMES,
      registers: [this.registry],
    });
    this.databaseQueriesTotal = new Counter({
      name: `${METRIC_PREFIX}db_queries_total`,
      help: 'Total number of database queries completed by Prisma.',
      labelNames: DATABASE_QUERY_LABEL_NAMES,
      registers: [this.registry],
    });
    this.databaseQueryDurationSeconds = new Histogram({
      name: `${METRIC_PREFIX}db_query_duration_seconds`,
      help: 'Database query duration reported by Prisma, in seconds.',
      labelNames: DATABASE_QUERY_LABEL_NAMES,
      buckets: DATABASE_QUERY_DURATION_BUCKETS_IN_SECONDS,
      registers: [this.registry],
    });
  }

  get contentType(): RegistryContentType {
    return this.registry.contentType;
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  incrementHttpRequestsInProgress(labels: HttpRequestMetricLabels): void {
    this.httpRequestsInProgress.inc(labels);
  }

  decrementHttpRequestsInProgress(labels: HttpRequestMetricLabels): void {
    this.httpRequestsInProgress.dec(labels);
  }

  observeHttpRequest(
    labels: HttpResponseMetricLabels,
    durationInSeconds: number,
  ): void {
    const responseLabels = {
      method: labels.method,
      route: labels.route,
      status_code: String(labels.statusCode),
    };

    this.httpRequestsTotal.inc(responseLabels);
    this.httpRequestDurationSeconds.observe(responseLabels, durationInSeconds);
  }

  observeDatabaseQuery(
    labels: DatabaseQueryMetricLabels,
    durationInSeconds: number,
  ): void {
    this.databaseQueriesTotal.inc(labels);
    this.databaseQueryDurationSeconds.observe(labels, durationInSeconds);
  }
}
