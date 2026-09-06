import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { REDIS_CLIENT } from '../../../infrastructure/redis/redis.module';
import { MetricsGateway } from './metrics.gateway';

// Records HTTP response times into a Redis rolling window for percentile metrics.
// Also emits each request to the /metrics WebSocket namespace for the live feed.
@Injectable()
export class LatencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly metricsGateway?: MetricsGateway,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const start = Date.now();
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        void this.redis
          .pipeline()
          .lpush('api:latencies', ms)
          .ltrim('api:latencies', 0, 499)
          .exec();

        if (this.metricsGateway) {
          const path = (req.url ?? '/').split('?')[0];
          if (!path.startsWith('/socket.io')) {
            this.metricsGateway.emitRequest({
              method: req.method ?? 'GET',
              path,
              status: res.statusCode,
              ms,
              ts: Date.now(),
            });
          }
        }
      }),
    );
  }
}
