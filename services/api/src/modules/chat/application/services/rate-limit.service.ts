import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.module';

interface WindowConfig {
  name: string;
  windowMs: number;
  limit: number;
}

@Injectable()
export class RateLimitService {
  private readonly windows: WindowConfig[];

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.windows = [
      {
        name: 'minute',
        windowMs: 60 * 1000,
        limit: parseInt(this.config.get<string>('RATE_LIMIT_PER_MINUTE') ?? '10', 10),
      },
      {
        name: 'hour',
        windowMs: 60 * 60 * 1000,
        limit: parseInt(this.config.get<string>('RATE_LIMIT_PER_HOUR') ?? '40', 10),
      },
      {
        name: 'day',
        windowMs: 24 * 60 * 60 * 1000,
        limit: parseInt(this.config.get<string>('RATE_LIMIT_PER_DAY') ?? '100', 10),
      },
    ];
  }

  /**
   * Normalises an IP for rate-limit keying.
   * IPv6 addresses are bucketed to the /64 prefix (first 4 groups).
   * IPv4 addresses pass through unchanged.
   */
  private normalizeIp(ip: string): string {
    // Strip IPv6-mapped IPv4 prefix (::ffff:1.2.3.4 → 1.2.3.4)
    const mapped = ip.replace(/^::ffff:/i, '');

    // Simple IPv6 detection: contains a colon and is not pure IPv4
    const isIPv6 = mapped.includes(':') && !mapped.match(/^\d+\.\d+\.\d+\.\d+$/);
    if (!isIPv6) return mapped;

    // Expand shorthand :: notation before slicing
    const expanded = expandIPv6(mapped);
    // /64 prefix = first 4 groups of the 8-group full address
    const groups = expanded.split(':');
    return groups.slice(0, 4).join(':');
  }

  /**
   * Sliding-window check using Redis sorted sets.
   * Checks both IP-based and session-based windows.
   * Returns { allowed: true } if all windows pass, or { allowed: false, limitType } if blocked.
   */
  async checkAndRecord(
    rawIp: string,
    sessionId: string,
  ): Promise<{ allowed: boolean; limitType: string | null }> {
    const normalizedIp = this.normalizeIp(rawIp);
    const now = Date.now();

    // Layer 0.5: blocklist check (exact IP, not normalised — allows targeting specific addresses)
    const blocked = await this.redis.sismember('blocklist', rawIp);
    if (blocked) {
      return { allowed: false, limitType: 'blocklist' };
    }

    // Check each sliding window for both IP and session
    for (const window of this.windows) {
      const windowStart = now - window.windowMs;
      const ipKey = `rl:ip:${normalizedIp}:${window.name}`;
      const sessionKey = `rl:session:${sessionId}:${window.name}`;

      // Use MULTI/EXEC pipeline for atomic read-then-write per key pair
      const [ipCount, sessionCount] = await this.slidingWindowCountAndRecord(
        [ipKey, sessionKey],
        windowStart,
        now,
        window.windowMs,
      );

      if (ipCount > window.limit) {
        return { allowed: false, limitType: `ip:${window.name}` };
      }
      if (sessionCount > window.limit) {
        return { allowed: false, limitType: `session:${window.name}` };
      }
    }

    return { allowed: true, limitType: null };
  }

  /**
   * For each key: remove stale entries, add current timestamp, count remaining.
   * Returns the post-add counts for each key.
   * Uses a pipeline (not a Lua script) for simplicity; minor TOCTOU is acceptable
   * for rate-limiting use cases.
   */
  private async slidingWindowCountAndRecord(
    keys: string[],
    windowStart: number,
    now: number,
    windowMs: number,
  ): Promise<number[]> {
    const ttlSeconds = Math.ceil(windowMs / 1000) + 1;
    const member = `${now}-${Math.random().toString(36).slice(2)}`; // unique member per call

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.zremrangebyscore(key, '-inf', windowStart); // evict old entries
      pipeline.zadd(key, now, member);                    // record this request
      pipeline.zcard(key);                                // count active entries
      pipeline.expire(key, ttlSeconds);                   // rolling TTL
    }

    const results = await pipeline.exec();
    if (!results) return keys.map(() => 0);

    // zcard result is at index 2, 6, 10, ... (every 4th result starting at index 2)
    const counts: number[] = [];
    for (let i = 0; i < keys.length; i++) {
      const cardResult = results[i * 4 + 2];
      counts.push(cardResult && cardResult[1] != null ? (cardResult[1] as number) : 0);
    }
    return counts;
  }
}

/**
 * Expands an IPv6 shorthand address (with ::) to its full 8-group representation.
 * Example: "2001:db8::1" → "2001:0db8:0000:0000:0000:0000:0000:0001"
 */
function expandIPv6(ip: string): string {
  // Already fully expanded
  if (!ip.includes('::')) return ip;

  const [left, right] = ip.split('::');
  const leftGroups = left ? left.split(':') : [];
  const rightGroups = right ? right.split(':') : [];
  const missing = 8 - leftGroups.length - rightGroups.length;
  const middle = Array<string>(missing).fill('0000');
  return [...leftGroups, ...middle, ...rightGroups]
    .map((g) => g.padStart(4, '0'))
    .join(':');
}
