import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrometheusMetricsService } from '../../infrastructure/prometheus/prometheus-metrics.service';

@ApiExcludeController()
@Controller('metrics')
export class PrometheusMetricsController {
  constructor(private readonly prometheusMetrics: PrometheusMetricsService) {}

  @Get()
  async getMetrics(
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    response.setHeader('Content-Type', this.prometheusMetrics.contentType);
    response.setHeader('Cache-Control', 'no-store');

    return this.prometheusMetrics.getMetrics();
  }
}
