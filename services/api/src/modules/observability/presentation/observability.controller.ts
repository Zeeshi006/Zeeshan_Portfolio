import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MetricsCollectorService } from '../application/metrics-collector.service';
import { SystemMetricsDto } from './system-metrics.dto';

@ApiTags('system')
@Controller('system')
export class ObservabilityController {
  constructor(private readonly collector: MetricsCollectorService) {}

  @Get('metrics')
  @Throttle({ default: { ttl: 60_000, limit: 200 } })
  @ApiOkResponse({ type: SystemMetricsDto })
  getMetrics(): Promise<SystemMetricsDto> {
    return this.collector.collect();
  }
}
