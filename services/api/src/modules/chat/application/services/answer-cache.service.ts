import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.module';
import { AnswerQuestionResult } from '../use-cases/answer-question.use-case';

@Injectable()
export class AnswerCacheService {
  private readonly CACHE_PREFIX = 'chat:cache:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async get(query: string): Promise<AnswerQuestionResult | null> {
    const key = this.buildKey(query);
    const cached = await this.redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as AnswerQuestionResult;
  }

  async set(query: string, result: AnswerQuestionResult): Promise<void> {
    const key = this.buildKey(query);
    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(result));
  }

  async invalidateAll(): Promise<void> {
    const keys = await this.redis.keys(this.CACHE_PREFIX + '*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private buildKey(query: string): string {
    // Normalize: lowercase, trim, collapse internal whitespace
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    return this.CACHE_PREFIX + normalized;
  }
}
