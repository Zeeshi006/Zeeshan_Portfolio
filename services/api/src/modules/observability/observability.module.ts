import { Module } from '@nestjs/common';
import { MetricsCollectorService } from './application/metrics-collector.service';
import { ObservabilityController } from './presentation/observability.controller';
import { LatencyInterceptor } from './infrastructure/latency.interceptor';
import { MetricsGateway } from './infrastructure/metrics.gateway';

@Module({
  controllers: [ObservabilityController],
  providers: [MetricsCollectorService, LatencyInterceptor, MetricsGateway],
  exports: [LatencyInterceptor, MetricsGateway],
})
export class ObservabilityModule {}
