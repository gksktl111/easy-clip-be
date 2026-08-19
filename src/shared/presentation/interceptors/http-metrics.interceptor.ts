import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, finalize, tap } from 'rxjs';
import {
  type HttpRequestMetricLabels,
  PrometheusMetricsService,
} from '../../infrastructure/prometheus/prometheus-metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly prometheusMetrics: PrometheusMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();

    if (request.path === '/metrics') {
      return next.handle();
    }

    const response = httpContext.getResponse<Response>();
    const labels = {
      method: request.method,
      route: resolveRoute(request),
    };
    const startedAt = process.hrtime.bigint();

    this.prometheusMetrics.incrementHttpRequestsInProgress(labels);

    return next.handle().pipe(
      tap({
        next: () => {
          this.observeRequest(labels, response.statusCode, startedAt);
        },
        error: (error: unknown) => {
          this.observeRequest(labels, resolveErrorStatusCode(error), startedAt);
        },
      }),
      finalize(() => {
        this.prometheusMetrics.decrementHttpRequestsInProgress(labels);
      }),
    );
  }

  private observeRequest(
    labels: HttpRequestMetricLabels,
    statusCode: number,
    startedAt: bigint,
  ): void {
    const durationInSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

    this.prometheusMetrics.observeHttpRequest(
      {
        ...labels,
        statusCode,
      },
      durationInSeconds,
    );
  }
}

function resolveRoute(request: Request): string {
  const requestWithRoute = request as unknown as {
    route?: { path?: unknown };
  };
  const routePath = requestWithRoute.route?.path;

  if (typeof routePath !== 'string') {
    return 'unmatched';
  }

  const route = `${request.baseUrl}${routePath}`.replace(/\/{2,}/g, '/');

  return route || '/';
}

function resolveErrorStatusCode(error: unknown): number {
  if (error instanceof HttpException) {
    return error.getStatus();
  }

  return 500;
}
