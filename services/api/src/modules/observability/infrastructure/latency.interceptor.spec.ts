import { LatencyInterceptor } from './latency.interceptor';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

function makeRedis() {
  const pipeline = { lpush: jest.fn().mockReturnThis(), ltrim: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) };
  return {
    pipeline: jest.fn().mockReturnValue(pipeline),
    _pipeline: pipeline,
  } as unknown as import('ioredis').default;
}

function makeContext(type: string): ExecutionContext {
  const req = { method: 'GET', url: '/test' };
  const res = { statusCode: 200 };
  return {
    getType: jest.fn().mockReturnValue(type),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(req),
      getResponse: jest.fn().mockReturnValue(res),
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(value = { data: 'ok' }): CallHandler {
  return { handle: jest.fn().mockReturnValue(of(value)) };
}

describe('LatencyInterceptor', () => {
  let interceptor: LatencyInterceptor;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
    interceptor = new LatencyInterceptor(redis);
  });

  it('records timing to Redis for HTTP requests', done => {
    const ctx = makeContext('http');
    const handler = makeHandler();
    const pipeline = (redis as any)._pipeline;

    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(pipeline.lpush).toHaveBeenCalledWith('api:latencies', expect.any(Number));
      expect(pipeline.ltrim).toHaveBeenCalledWith('api:latencies', 0, 499);
      expect(pipeline.exec).toHaveBeenCalled();
      done();
    });
  });

  it('skips recording for WebSocket context', done => {
    const ctx = makeContext('ws');
    const handler = makeHandler();
    const pipeline = (redis as any)._pipeline;

    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(pipeline.lpush).not.toHaveBeenCalled();
      done();
    });
  });

  it('skips recording for RPC context', done => {
    const ctx = makeContext('rpc');
    const handler = makeHandler();
    interceptor.intercept(ctx, handler).subscribe(() => {
      expect((redis as any)._pipeline.lpush).not.toHaveBeenCalled();
      done();
    });
  });

  it('records a non-negative latency value', done => {
    const ctx = makeContext('http');
    const handler = makeHandler();
    const pipeline = (redis as any)._pipeline;

    interceptor.intercept(ctx, handler).subscribe(() => {
      const recorded = (pipeline.lpush as jest.Mock).mock.calls[0][1] as number;
      expect(recorded).toBeGreaterThanOrEqual(0);
      done();
    });
  });
});
