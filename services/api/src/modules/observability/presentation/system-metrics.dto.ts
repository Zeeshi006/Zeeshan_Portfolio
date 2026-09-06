import { ApiProperty } from '@nestjs/swagger';

export class ApiMetricsDto {
  @ApiProperty({ description: 'Median response latency in ms' }) p50Ms!: number;
  @ApiProperty({ description: '99th-percentile latency in ms' }) p99Ms!: number;
  @ApiProperty({ description: 'API process uptime in seconds' }) uptimeSeconds!: number;
  @ApiProperty({ description: 'Rolling sample size' }) sampleSize!: number;
}

export class DbMetricsDto {
  @ApiProperty({ description: 'Active Postgres connections' }) activeConnections!: number;
  @ApiProperty({ description: 'Committed transactions per minute' }) txnPerMinute!: number;
}

export class RedisMetricsDto {
  @ApiProperty({ description: 'Cache hit rate 0–100' }) hitRatePct!: number;
  @ApiProperty({ description: 'Human-readable memory usage' }) memoryUsed!: string;
}

export class RagMetricsDto {
  @ApiProperty({ description: 'Published KB documents' }) docCount!: number;
  @ApiProperty({ nullable: true, description: 'Average embedding latency in ms' })
  avgEmbedMs!: number | null;
}

export class MetricsHistoryDto {
  @ApiProperty({ type: [Number], description: 'Last 30 p50 readings (ms)' }) p50!: number[];
  @ApiProperty({ type: [Number], description: 'Last 30 p99 readings (ms)' }) p99!: number[];
  @ApiProperty({ type: [Number], description: 'Last 30 active connection readings' }) connections!: number[];
  @ApiProperty({ type: [Number], description: 'Last 30 txn/min readings' }) txnPerMin!: number[];
  @ApiProperty({ type: [Number], description: 'Last 30 visitor count readings' }) visitors!: number[];
}

export class SystemMetricsDto {
  @ApiProperty({ type: ApiMetricsDto }) api!: ApiMetricsDto;
  @ApiProperty({ type: DbMetricsDto }) db!: DbMetricsDto;
  @ApiProperty({ type: RedisMetricsDto }) redis!: RedisMetricsDto;
  @ApiProperty({ type: RagMetricsDto }) rag!: RagMetricsDto;
  @ApiProperty({ type: MetricsHistoryDto }) history!: MetricsHistoryDto;
  @ApiProperty({ description: 'WebSocket-connected visitors right now' }) visitorsOnline!: number;
  @ApiProperty({ description: 'Unix ms timestamp of collection' }) timestamp!: number;
}
