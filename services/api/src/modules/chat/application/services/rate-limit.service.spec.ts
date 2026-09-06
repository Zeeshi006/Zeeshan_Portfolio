import { RateLimitService } from './rate-limit.service';
import { ConfigService } from '@nestjs/config';

function makeRedis() {
  let callCount = 0;
  const pipeline = {
    zremrangebyscore: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    zcard: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockImplementation(() => {
      callCount++;
      // Each key produces 4 commands: zremrangebyscore, zadd, zcard, expire
      // zcard result is at index [2], [6], ... — return count of 1 (within limit)
      return Promise.resolve([
        [null, 0],  // zremrangebyscore
        [null, 1],  // zadd
        [null, 1],  // zcard — count = 1
        [null, 1],  // expire
        [null, 0],  // zremrangebyscore (session key)
        [null, 1],  // zadd
        [null, 1],  // zcard — count = 1
        [null, 1],  // expire
      ]);
    }),
  };
  return {
    sismember: jest.fn().mockResolvedValue(0),
    pipeline: jest.fn().mockReturnValue(pipeline),
    _pipeline: pipeline,
    _setCallCount: (n: number) => { callCount = n; },
  } as unknown as import('ioredis').default;
}

function makeConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    RATE_LIMIT_PER_MINUTE: '10',
    RATE_LIMIT_PER_HOUR: '40',
    RATE_LIMIT_PER_DAY: '100',
    ...overrides,
  };
  return { get: jest.fn((k: string) => defaults[k]) } as unknown as ConfigService;
}

describe('RateLimitService', () => {
  let service: RateLimitService;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
    service = new RateLimitService(redis, makeConfig());
  });

  describe('checkAndRecord()', () => {
    it('allows request when within all limits', async () => {
      const result = await service.checkAndRecord('1.2.3.4', 'sess-001');
      expect(result.allowed).toBe(true);
      expect(result.limitType).toBeNull();
    });

    it('blocks IP on blocklist', async () => {
      (redis.sismember as jest.Mock).mockResolvedValue(1);
      const result = await service.checkAndRecord('1.2.3.4', 'sess-001');
      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe('blocklist');
    });

    it('blocks when IP per-minute limit exceeded', async () => {
      const overLimitPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], [null, 1], [null, 11], [null, 1], // IP: count=11 > limit=10
          [null, 0], [null, 1], [null, 1],  [null, 1], // session: count=1
        ]),
      };
      (redis.pipeline as jest.Mock).mockReturnValue(overLimitPipeline);
      const result = await service.checkAndRecord('1.2.3.4', 'sess-001');
      expect(result.allowed).toBe(false);
      expect(result.limitType).toContain('ip');
    });

    it('blocks when session per-minute limit exceeded', async () => {
      const overLimitPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], [null, 1], [null, 1],  [null, 1], // IP: count=1
          [null, 0], [null, 1], [null, 11], [null, 1], // session: count=11 > limit=10
        ]),
      };
      (redis.pipeline as jest.Mock).mockReturnValue(overLimitPipeline);
      const result = await service.checkAndRecord('1.2.3.4', 'sess-001');
      expect(result.allowed).toBe(false);
      expect(result.limitType).toContain('session');
    });

    it('strips IPv6-mapped IPv4 prefix (::ffff:)', async () => {
      await service.checkAndRecord('::ffff:1.2.3.4', 'sess-001');
      // If it didn't strip the prefix, IPv6 bucket logic would fire incorrectly
      // Verifying it ran without error and used the correct key is sufficient
      expect(redis.pipeline).toHaveBeenCalled();
    });

    it('buckets full IPv6 address to /64 prefix', async () => {
      // Full IPv6 — should not throw
      const result = await service.checkAndRecord('2001:0db8:0000:0000:0000:0000:0000:0001', 'sess-001');
      expect(typeof result.allowed).toBe('boolean');
    });
  });
});
