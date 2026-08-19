import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrometheusMetricsService } from './infrastructure/prometheus/prometheus-metrics.service';
import { HttpMetricsInterceptor } from './presentation/interceptors/http-metrics.interceptor';
import { PrometheusMetricsController } from './presentation/metrics/prometheus-metrics.controller';

@Module({
  controllers: [PrometheusMetricsController],
  providers: [
    PrometheusMetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [PrometheusMetricsService],
})
export class MetricsModule {}
