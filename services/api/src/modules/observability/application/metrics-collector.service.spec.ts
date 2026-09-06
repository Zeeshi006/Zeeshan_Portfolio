import { MetricsCollectorService } from './metrics-collector.service';

function makePipeline() {
  const pipe: Record<string, jest.Mock> = {
    rpush: jest.fn(),
    ltrim: jest.fn(),
    exec: jest.fn().mockResolvedValue([]),
  };
  pipe['rpush'].mockReturnValue(pipe);
  pipe['ltrim'].mockReturnValue(pipe);
  return pipe;
}

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    lrange: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    info: jest.fn().mockResolvedValue('keyspace_hits:0\nkeyspace_misses:0\nused_memory_human:1.00M\r\n'),
    pipeline: jest.fn().mockReturnValue(makePipeline()),
    ...overrides,
  } as unknown as import('ioredis').default;
}

function makePrisma(overrides: Record<string, jest.Mock> = {}) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(3), total: BigInt(1000) }]),
    kBDocument: { count: jest.fn().mockResolvedValue(47) },
    ...overrides,
  };
}

describe('MetricsCollectorService', () => {
  let service: MetricsCollectorService;
  let redis: ReturnType<typeof makeRedis>;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    redis = makeRedis();
    prisma = makePrisma();
    service = new MetricsCollectorService(redis, prisma as any);
  });

  describe('collect()', () => {
    it('returns correct DTO shape', async () => {
      const result = await service.collect();
      expect(result).toMatchObject({
        api: { p50Ms: expect.any(Number), p99Ms: expect.any(Number), uptimeSeconds: expect.any(Number), sampleSize: expect.any(Number) },
        db: { activeConnections: expect.any(Number), txnPerMinute: expect.any(Number) },
        redis: { hitRatePct: expect.any(Number), memoryUsed: expect.any(String) },
        rag: { docCount: expect.any(Number), avgEmbedMs: null },
        visitorsOnline: expect.any(Number),
        timestamp: expect.any(Number),
      });
    });

    it('timestamp is close to now', async () => {
      const before = Date.now();
      const result = await service.collect();
      const after = Date.now();
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it('returns visitors count from Redis key', async () => {
      (redis.get as jest.Mock).mockImplementation((key: string) =>
        key === 'visitors:online' ? Promise.resolve('5') : Promise.resolve(null),
      );
      const result = await service.collect();
      expect(result.visitorsOnline).toBe(5);
    });

    it('returns 0 visitors when key is absent', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const result = await service.collect();
      expect(result.visitorsOnline).toBe(0);
    });
  });

  describe('API metrics (p50/p99 calculation)', () => {
    it('calculates p50 correctly from sorted samples', async () => {
      // 10 samples: 10, 20, 30, ..., 100 — p50 at index 5 = 60ms
      (redis.lrange as jest.Mock).mockResolvedValue(['10','20','30','40','50','60','70','80','90','100']);
      const result = await service.collect();
      expect(result.api.p50Ms).toBe(60);
    });

    it('calculates p99 correctly', async () => {
      const samples = Array.from({ length: 100 }, (_, i) => String(i + 1));
      (redis.lrange as jest.Mock).mockResolvedValue(samples);
      const result = await service.collect();
      // p99 at index floor(100 * 0.99) = 99 → value = 100
      expect(result.api.p99Ms).toBe(100);
    });

    it('returns zeros when no samples exist', async () => {
      (redis.lrange as jest.Mock).mockResolvedValue([]);
      const result = await service.collect();
      expect(result.api.p50Ms).toBe(0);
      expect(result.api.p99Ms).toBe(0);
      expect(result.api.sampleSize).toBe(0);
    });

    it('returns fallback on Redis error', async () => {
      (redis.lrange as jest.Mock).mockRejectedValue(new Error('connection refused'));
      const result = await service.collect();
      expect(result.api.p50Ms).toBe(0);
      expect(result.api.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Redis metrics (hit rate)', () => {
    it('calculates hit rate from INFO stats', async () => {
      (redis.info as jest.Mock).mockResolvedValue(
        'keyspace_hits:90\r\nkeyspace_misses:10\r\nused_memory_human:42.5M\r\n',
      );
      const result = await service.collect();
      expect(result.redis.hitRatePct).toBe(90);
      expect(result.redis.memoryUsed).toBe('42.5M');
    });

    it('returns 0% hit rate when no cache activity', async () => {
      (redis.info as jest.Mock).mockResolvedValue('keyspace_hits:0\r\nkeyspace_misses:0\r\n');
      const result = await service.collect();
      expect(result.redis.hitRatePct).toBe(0);
    });

    it('returns fallback on Redis INFO error', async () => {
      (redis.info as jest.Mock).mockRejectedValue(new Error('timeout'));
      const result = await service.collect();
      expect(result.redis.hitRatePct).toBe(0);
      expect(result.redis.memoryUsed).toBe('N/A');
    });
  });

  describe('RAG metrics', () => {
    it('returns doc count from Prisma', async () => {
      prisma.kBDocument.count.mockResolvedValue(47);
      (redis.lrange as jest.Mock).mockResolvedValue([]);
      const result = await service.collect();
      expect(result.rag.docCount).toBe(47);
    });

    it('returns avgEmbedMs when embed times exist', async () => {
      (redis.lrange as jest.Mock).mockImplementation((key: string) =>
        key === 'rag:embed_times' ? Promise.resolve(['100', '200', '300']) : Promise.resolve([]),
      );
      const result = await service.collect();
      expect(result.rag.avgEmbedMs).toBe(200);
    });

    it('returns null avgEmbedMs when no embed history', async () => {
      (redis.lrange as jest.Mock).mockResolvedValue([]);
      const result = await service.collect();
      expect(result.rag.avgEmbedMs).toBeNull();
    });
  });

  describe('DB transaction rate', () => {
    it('returns 0 on first call (no prior snapshot)', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const result = await service.collect();
      expect(result.db.txnPerMinute).toBe(0);
    });

    it('calculates rate from delta on second call', async () => {
      const twoMinutesAgo = Date.now() - 2 * 60_000;
      (redis.get as jest.Mock).mockImplementation((key: string) =>
        key === 'db:txn_snapshot'
          ? Promise.resolve(JSON.stringify({ count: 800, ts: twoMinutesAgo }))
          : Promise.resolve(null),
      );
      // $queryRaw returns total=1000, previous=800, elapsed=2min → rate=100/min
      prisma.$queryRaw = jest.fn()
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ total: BigInt(1000) }]);
      const result = await service.collect();
      expect(result.db.txnPerMinute).toBe(100);
    });
  });
});
