import { AnswerCacheService } from './answer-cache.service';
import type { AnswerQuestionResult } from '../use-cases/answer-question.use-case';

const mockResult: AnswerQuestionResult = {
  answer: 'Hammad uses NestJS and PostgreSQL.',
  sources: [{ id: 'doc-1', title: 'Stack Overview' }],
  toolCalls: [],
};

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    get: jest.fn(),
    setex: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn(),
    ...overrides,
  } as unknown as import('ioredis').default;
}

describe('AnswerCacheService', () => {
  let service: AnswerCacheService;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
    service = new AnswerCacheService(redis);
  });

  describe('get()', () => {
    it('returns parsed result when key exists', async () => {
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockResult));
      const result = await service.get('What stack does Hammad use?');
      expect(result).toEqual(mockResult);
    });

    it('returns null when key does not exist', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      expect(await service.get('unknown query')).toBeNull();
    });
  });

  describe('set()', () => {
    it('stores result with 1-hour TTL', async () => {
      await service.set('What stack?', mockResult);
      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining('chat:cache:'),
        3600,
        JSON.stringify(mockResult),
      );
    });

    it('normalises the cache key (lowercase + trim + collapse spaces)', async () => {
      await service.set('  WHAT  stack  does  Hammad  use?  ', mockResult);
      expect(redis.setex).toHaveBeenCalledWith(
        'chat:cache:what stack does hammad use?',
        expect.any(Number),
        expect.any(String),
      );
    });
  });

  describe('invalidateAll()', () => {
    it('deletes all chat:cache:* keys', async () => {
      (redis.keys as jest.Mock).mockResolvedValue(['chat:cache:a', 'chat:cache:b']);
      await service.invalidateAll();
      expect(redis.del).toHaveBeenCalledWith('chat:cache:a', 'chat:cache:b');
    });

    it('does not call del when no keys found', async () => {
      (redis.keys as jest.Mock).mockResolvedValue([]);
      await service.invalidateAll();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
