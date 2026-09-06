import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.module';

@Injectable()
export class SpendGuardService {
  private readonly logger = new Logger(SpendGuardService.name);

  // Cost rates per 1k tokens (defaults match DeepSeek V3/Flash + OpenAI ada-002)
  private readonly deepSeekInputCostPer1k: number;
  private readonly deepSeekOutputCostPer1k: number;
  private readonly embeddingCostPer1k: number;
  private readonly dailyCeilingUsd: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.deepSeekInputCostPer1k = parseFloat(
      this.config.get<string>('DEEPSEEK_INPUT_COST_PER_1K') ?? '0.00014',
    );
    this.deepSeekOutputCostPer1k = parseFloat(
      this.config.get<string>('DEEPSEEK_OUTPUT_COST_PER_1K') ?? '0.00028',
    );
    this.embeddingCostPer1k = parseFloat(
      this.config.get<string>('EMBEDDING_COST_PER_1K') ?? '0.00002',
    );
    this.dailyCeilingUsd = parseFloat(
      this.config.get<string>('DAILY_SPEND_CEILING_USD') ?? '0.50',
    );
  }

  private getDailyKey(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `spend:${yyyy}-${mm}-${dd}`;
  }

  /**
   * Records the cost of a completed LLM call into the daily Redis accumulator.
   * Uses INCRBYFLOAT for atomic float addition; sets 48h TTL on first write.
   */
  async recordSpend(
    inputTokens: number,
    outputTokens: number,
    embeddingTokens: number,
  ): Promise<void> {
    const cost =
      (inputTokens / 1000) * this.deepSeekInputCostPer1k +
      (outputTokens / 1000) * this.deepSeekOutputCostPer1k +
      (embeddingTokens / 1000) * this.embeddingCostPer1k;

    const key = this.getDailyKey();

    // INCRBYFLOAT is atomic; EXPIRE only if the key is brand new (NX flag)
    const pipeline = this.redis.pipeline();
    pipeline.incrbyfloat(key, cost);
    pipeline.expire(key, 48 * 60 * 60); // 48h TTL — key self-cleans after 2 days
    await pipeline.exec();
  }

  async getDailySpend(): Promise<number> {
    const raw = await this.redis.get(this.getDailyKey());
    return raw ? parseFloat(raw) : 0;
  }

  getDailyCeiling(): number {
    return this.dailyCeilingUsd;
  }

  async isDailyLimitExceeded(): Promise<boolean> {
    const spend = await this.getDailySpend();
    if (spend >= this.dailyCeilingUsd) {
      this.logger.warn(
        `Daily spend ceiling reached: $${spend.toFixed(4)} >= $${this.dailyCeilingUsd}`,
      );
      return true;
    }
    return false;
  }
}
