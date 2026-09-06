import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.module';
import { IEmbeddingProvider, EMBEDDING_PROVIDER } from '../../domain/ports/embedding-provider.port';

const EMBED_CACHE_PREFIX = 'embed:cache:';
const EMBED_CACHE_TTL = 48 * 60 * 60; // 48h

@Injectable()
export class EmbeddingCacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: IEmbeddingProvider,
  ) {}

  async embed(text: string): Promise<number[]> {
    const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
    const hash = createHash('sha256').update(normalized).digest('hex');
    const key = EMBED_CACHE_PREFIX + hash;

    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as number[];
    }

    const embedding = await this.embeddingProvider.embed(text);
    // Fire-and-forget cache write — never block the embedding call
    this.redis.setex(key, EMBED_CACHE_TTL, JSON.stringify(embedding)).catch(() => {});
    return embedding;
  }
}
