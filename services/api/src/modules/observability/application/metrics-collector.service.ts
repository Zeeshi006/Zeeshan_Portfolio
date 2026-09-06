import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../infrastructure/redis/redis.module';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  SystemMetricsDto,
  ApiMetricsDto,
  DbMetricsDto,
  RedisMetricsDto,
  RagMetricsDto,
} from '../presentation/system-metrics.dto';

@Injectable()
export class MetricsCollectorService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async collect(): Promise<SystemMetricsDto> {
    const [api, db, cache, rag, visitorsRaw] = await Promise.all([
      this.collectApi(),
      this.collectDb(),
      this.collectRedis(),
      this.collectRag(),
      this.redis.get('visitors:online'),
    ]);

    const visitorsOnline = visitorsRaw ? Number(visitorsRaw) : 0;
    const history = await this.updateHistory({
      p50: api.p50Ms,
      p99: api.p99Ms,
      connections: db.activeConnections,
      txnPerMin: db.txnPerMinute,
      visitors: visitorsOnline,
    });

    return {
      api,
      db,
      redis: cache,
      rag,
      history,
      visitorsOnline,
      timestamp: Date.now(),
    };
  }

  // Push latest reading to each history list (capped at 30 points) then return all histories.
  private async updateHistory(current: {
    p50: number;
    p99: number;
    connections: number;
    txnPerMin: number;
    visitors: number;
  }) {
    const empty = { p50: [], p99: [], connections: [], txnPerMin: [], visitors: [] };
    try {
      const LIMIT = 30;
      const entries: [string, number][] = [
        ['metrics:h:p50', current.p50],
        ['metrics:h:p99', current.p99],
        ['metrics:h:conn', current.connections],
        ['metrics:h:txn', current.txnPerMin],
        ['metrics:h:vis', current.visitors],
      ];

      const pipe = this.redis.pipeline();
      for (const [key, value] of entries) {
        pipe.rpush(key, value).ltrim(key, -LIMIT, -1);
      }
      await pipe.exec();

      const ranges = await Promise.all(entries.map(([key]) => this.redis.lrange(key, 0, -1)));

      return {
        p50: (ranges[0] ?? []).map(Number),
        p99: (ranges[1] ?? []).map(Number),
        connections: (ranges[2] ?? []).map(Number),
        txnPerMin: (ranges[3] ?? []).map(Number),
        visitors: (ranges[4] ?? []).map(Number),
      };
    } catch {
      return empty;
    }
  }

  private async collectApi(): Promise<ApiMetricsDto> {
    try {
      const raw = await this.redis.lrange('api:latencies', 0, -1);
      const nums = raw.map(Number).sort((a, b) => a - b);
      const p50 = nums[Math.floor(nums.length * 0.5)] ?? 0;
      const p99 = nums[Math.floor(nums.length * 0.99)] ?? 0;
      return {
        p50Ms: p50,
        p99Ms: p99,
        uptimeSeconds: Math.floor(process.uptime()),
        sampleSize: nums.length,
      };
    } catch {
      return { p50Ms: 0, p99Ms: 0, uptimeSeconds: Math.floor(process.uptime()), sampleSize: 0 };
    }
  }

  private async collectDb(): Promise<DbMetricsDto> {
    try {
      const [connRows, txnRows] = await Promise.all([
        this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) AS count
          FROM pg_stat_activity
          WHERE datname = current_database() AND state IS NOT NULL
        `,
        this.prisma.$queryRaw<[{ total: bigint }]>`
          SELECT xact_commit + xact_rollback AS total
          FROM pg_stat_database
          WHERE datname = current_database()
        `,
      ]);

      const activeConnections = Number(connRows[0]?.count ?? 0);
      const txnNow = Number(txnRows[0]?.total ?? 0);
      const txnPerMinute = await this.calcTxnRate(txnNow);

      return { activeConnections, txnPerMinute };
    } catch {
      return { activeConnections: 0, txnPerMinute: 0 };
    }
  }

  private async collectRedis(): Promise<RedisMetricsDto> {
    try {
      const [stats, mem] = await Promise.all([
        this.redis.info('stats'),
        this.redis.info('memory'),
      ]);
      const hits = this.parseInfoNum(stats, 'keyspace_hits');
      const misses = this.parseInfoNum(stats, 'keyspace_misses');
      const total = hits + misses;
      const hitRatePct = total > 0 ? Math.round((hits / total) * 100) : 0;
      const memMatch = mem.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsed = memMatch?.[1]?.trim() ?? 'N/A';
      return { hitRatePct, memoryUsed };
    } catch {
      return { hitRatePct: 0, memoryUsed: 'N/A' };
    }
  }

  private async collectRag(): Promise<RagMetricsDto> {
    try {
      const [docCount, embedTimes] = await Promise.all([
        this.prisma.kBDocument.count({ where: { published: true } }),
        this.redis.lrange('rag:embed_times', 0, -1),
      ]);
      const nums = embedTimes.map(Number);
      const avgEmbedMs =
        nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
      return { docCount, avgEmbedMs };
    } catch {
      return { docCount: 0, avgEmbedMs: null };
    }
  }

  // Delta-rate: compare current cumulative txn count to the last snapshot stored in Redis.
  private async calcTxnRate(current: number): Promise<number> {
    const key = 'db:txn_snapshot';
    const raw = await this.redis.get(key);
    const now = Date.now();
    const snapshot = { count: current, ts: now };

    if (raw) {
      const prev = JSON.parse(raw) as { count: number; ts: number };
      const elapsedMin = (now - prev.ts) / 60_000;
      if (elapsedMin > 0.01) {
        const rate = Math.max(0, Math.round((current - prev.count) / elapsedMin));
        await this.redis.setex(key, 120, JSON.stringify(snapshot));
        return rate;
      }
    }

    await this.redis.setex(key, 120, JSON.stringify(snapshot));
    return 0;
  }

  private parseInfoNum(info: string, key: string): number {
    const m = info.match(new RegExp(`${key}:(\\d+)`));
    return m ? Number(m[1]) : 0;
  }
}
