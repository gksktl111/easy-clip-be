import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrometheusMetricsService } from '../shared/infrastructure/prometheus/prometheus-metrics.service';
import { resolvePrismaQueryMetricLabels } from '../shared/infrastructure/prometheus/prisma-query-metrics.helper';

type PrismaQueryLogOptions = {
  log: [{ emit: 'event'; level: 'query' }];
};

@Injectable()
export class PrismaService
  extends PrismaClient<PrismaQueryLogOptions>
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly prometheusMetrics: PrometheusMetricsService) {
    super({
      log: [{ emit: 'event', level: 'query' }],
    });

    this.$on('query', (event) => {
      this.prometheusMetrics.observeDatabaseQuery(
        resolvePrismaQueryMetricLabels(event.query),
        event.duration / 1_000,
      );
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
