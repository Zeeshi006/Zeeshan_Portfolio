import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { TerminusModule } from "@nestjs/terminus";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./infrastructure/database/prisma.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { ContentModule } from "./modules/content/content.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ContactModule } from "./modules/contact/contact.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { ChatModule } from "./modules/chat/chat.module";
import { GitHubModule } from "./modules/github/github.module";
import { ObservabilityModule } from "./modules/observability/observability.module";
import { BlogModule } from "./modules/blog/blog.module";
import { SearchModule } from "./modules/search/search.module";
import { LatencyInterceptor } from "./modules/observability/infrastructure/latency.interceptor";
import { HealthController } from "./presentation/health/health.controller";
import appConfig from "./infrastructure/config/app.config";
import * as Joi from "joi";

@Module({
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LatencyInterceptor },
  ],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: Joi.object({
        DATABASE_URL:        Joi.string().required(),
        REDIS_URL:           Joi.string().default('redis://localhost:6379'),
        JWT_SECRET:          Joi.string().min(32).required(),
        OPENROUTER_API_KEY:  Joi.string().required(),
        ELEVENLABS_API_KEY:  Joi.string().required(),
        ELEVENLABS_AGENT_ID: Joi.string().required(),
        TRANSCRIPT_SECRET:   Joi.string().min(32).required(),
        ALLOWED_ORIGINS:     Joi.string().optional(),
        API_PORT:            Joi.number().default(3001),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379' },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: 500,
          removeOnFail: 200,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    // Global throttle: 100 req / 60 s per IP — login endpoint overrides to 5/60s
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    ContentModule,
    ContactModule,
    AnalyticsModule,
    ChatModule,
    GitHubModule,
    ObservabilityModule,
    BlogModule,
    SearchModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
