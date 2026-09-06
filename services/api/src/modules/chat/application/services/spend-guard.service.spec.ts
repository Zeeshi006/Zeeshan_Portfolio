import { SpendGuardService } from './spend-guard.service';
import { ConfigService } from '@nestjs/config';

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  const pipeline = { incrbyfloat: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) };
  return {
    get: jest.fn(),
    pipeline: jest.fn().mockReturnValue(pipeline),
    _pipeline: pipeline,
    ...overrides,
  } as unknown as import('ioredis').default;
}

function makeConfig(overrides: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => overrides[key] ?? undefined),
  } as unknown as ConfigService;
}

describe('SpendGuardService', () => {
  let service: SpendGuardService;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
    service = new SpendGuardService(redis, makeConfig({ DAILY_SPEND_CEILING_USD: '0.50' }));
  });

  describe('isDailyLimitExceeded()', () => {
    it('returns false when spend is below ceiling', async () => {
      (redis.get as jest.Mock).mockResolvedValue('0.10');
      expect(await service.isDailyLimitExceeded()).toBe(false);
    });

    it('returns true when spend equals ceiling', async () => {
      (redis.get as jest.Mock).mockResolvedValue('0.50');
      expect(await service.isDailyLimitExceeded()).toBe(true);
    });

    it('returns true when spend exceeds ceiling', async () => {
      (redis.get as jest.Mock).mockResolvedValue('0.75');
      expect(await service.isDailyLimitExceeded()).toBe(true);
    });

    it('returns false when Redis has no entry (0 spend)', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      expect(await service.isDailyLimitExceeded()).toBe(false);
    });
  });

  describe('getDailySpend()', () => {
    it('returns parsed float from Redis', async () => {
      (redis.get as jest.Mock).mockResolvedValue('0.12345');
      expect(await service.getDailySpend()).toBeCloseTo(0.12345);
    });

    it('returns 0 when key is absent', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      expect(await service.getDailySpend()).toBe(0);
    });
  });

  describe('recordSpend()', () => {
    it('calls INCRBYFLOAT with computed cost', async () => {
      // With default rates: input=1000 tokens @ 0.00014/1k, output=500 @ 0.00028/1k, embed=200 @ 0.00002/1k
      await service.recordSpend(1000, 500, 200);
      const pipeline = (redis as any)._pipeline;
      expect(pipeline.incrbyfloat).toHaveBeenCalled();
      expect(pipeline.expire).toHaveBeenCalled();
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('sets 48-hour TTL on the daily key', async () => {
      await service.recordSpend(100, 100, 100);
      const pipeline = (redis as any)._pipeline;
      expect(pipeline.expire).toHaveBeenCalledWith(expect.any(String), 48 * 60 * 60);
    });
  });
});
