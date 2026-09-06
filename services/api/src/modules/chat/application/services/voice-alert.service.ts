import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Resend } from 'resend';
import { Redis } from 'ioredis';

const ALERT_THRESHOLD = 0.20; // warn when < 20% characters remaining
const ALERT_COOLDOWN_KEY = 'voice:alert:sent';
const ALERT_COOLDOWN_TTL = 86_400; // 24h in seconds

export interface ElevenLabsSubscription {
  character_count: number;
  character_limit: number;
  next_character_count_reset_unix?: number;
}

@Injectable()
export class VoiceAlertService implements OnModuleInit {
  private readonly logger = new Logger(VoiceAlertService.name);
  private readonly apiKey: string | undefined;
  private readonly resend: Resend | null;
  private readonly adminEmail: string;
  private redis: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('ELEVENLABS_API_KEY');
    const resendKey = config.get<string>('RESEND_API_KEY');
    this.resend = resendKey ? new Resend(resendKey) : null;
    this.adminEmail = config.get<string>('ADMIN_EMAIL') ?? 'hammad.afzal.code@gmail.com';
  }

  onModuleInit() {
    const redisUrl = this.config.get<string>('app.redisUrl') ?? 'redis://localhost:6379';
    try {
      this.redis = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false });
    } catch {
      this.logger.warn('Redis unavailable — alert dedup disabled');
    }
  }

  async fetchUsage(): Promise<ElevenLabsSubscription | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': this.apiKey },
      });
      if (!res.ok) {
        this.logger.warn(`ElevenLabs subscription fetch failed: ${res.status}`);
        return null;
      }
      return (await res.json()) as ElevenLabsSubscription;
    } catch (err) {
      this.logger.error('ElevenLabs subscription fetch error', err);
      return null;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkAndAlert(): Promise<void> {
    const usage = await this.fetchUsage();
    if (!usage || usage.character_limit === 0) return;

    const remaining = usage.character_limit - usage.character_count;
    const fraction = remaining / usage.character_limit;

    this.logger.log(
      `ElevenLabs chars: ${usage.character_count.toLocaleString()} / ${usage.character_limit.toLocaleString()} used (${Math.round(fraction * 100)}% remaining)`,
    );

    if (fraction >= ALERT_THRESHOLD) return;

    // Dedup via Redis — only one alert per 24h
    if (this.redis) {
      try {
        const exists = await this.redis.get(ALERT_COOLDOWN_KEY);
        if (exists) {
          this.logger.debug('Voice alert already sent — cooldown active');
          return;
        }
        await this.redis.set(ALERT_COOLDOWN_KEY, '1', 'EX', ALERT_COOLDOWN_TTL);
      } catch {
        // Redis unavailable — still send the alert
      }
    }

    await this.sendAlert(usage, remaining, fraction);
  }

  private async sendAlert(
    usage: ElevenLabsSubscription,
    remaining: number,
    fraction: number,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set — cannot send voice alert email');
      return;
    }

    const pct = Math.round(fraction * 100);
    const resetDate = usage.next_character_count_reset_unix
      ? new Date(usage.next_character_count_reset_unix * 1000).toUTCString()
      : 'unknown';

    try {
      await this.resend.emails.send({
        from: 'Portfolio Monitor <onboarding@resend.dev>',
        to: this.adminEmail,
        subject: `⚠ ElevenLabs voice credits low — ${pct}% remaining`,
        html: `
          <div style="font-family:monospace;max-width:600px;padding:24px;background:#0F1218;color:#E8ECF2;border-radius:8px">
            <h2 style="color:#FFB020;margin-top:0">⚠ Voice AI Credits Low</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
              <tr><td style="color:#5C6573;padding:6px 0;width:140px">Characters used</td><td style="color:#E8ECF2">${usage.character_count.toLocaleString()}</td></tr>
              <tr><td style="color:#5C6573;padding:6px 0">Character limit</td><td style="color:#E8ECF2">${usage.character_limit.toLocaleString()}</td></tr>
              <tr><td style="color:#5C6573;padding:6px 0">Remaining</td><td style="color:#FFB020;font-weight:bold">${remaining.toLocaleString()} (${pct}%)</td></tr>
              <tr><td style="color:#5C6573;padding:6px 0">Resets at</td><td style="color:#E8ECF2">${resetDate}</td></tr>
            </table>
            <p style="color:#99A2B2;margin:0">
              Top up at <a href="https://elevenlabs.io/app/subscription" style="color:#C6FF3A">elevenlabs.io/app/subscription</a>
              or wait for the billing period to reset.
            </p>
          </div>
        `,
      });
      this.logger.log(`Voice low-credit alert sent to ${this.adminEmail}`);
    } catch (err) {
      this.logger.error('Failed to send voice alert email', err);
    }
  }
}
