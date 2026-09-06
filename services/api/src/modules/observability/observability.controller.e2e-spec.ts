import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startContainers, stopContainers } from '../../test/containers';
import { buildTestApp } from '../../test/app-helper';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { fixtures } from '../../test/fixtures';

jest.setTimeout(120_000);

describe('ObservabilityController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    await startContainers();
    app = await buildTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await stopContainers();
  });

  beforeEach(async () => {
    await prisma.analyticsEvent.deleteMany();
    await prisma.kBDocument.deleteMany();
  });

  // ── GET /system/metrics ──────────────────────────────────────────────────────

  describe('GET /system/metrics', () => {
    it('returns 200', async () => {
      const res = await request(app.getHttpServer()).get('/system/metrics');
      expect(res.status).toBe(200);
    });

    it('returns the correct DTO structure', async () => {
      const res = await request(app.getHttpServer()).get('/system/metrics');

      expect(res.body).toMatchObject({
        api: {
          p50Ms: expect.any(Number),
          p99Ms: expect.any(Number),
          uptimeSeconds: expect.any(Number),
          sampleSize: expect.any(Number),
        },
        db: {
          activeConnections: expect.any(Number),
          txnPerMinute: expect.any(Number),
        },
        redis: {
          hitRatePct: expect.any(Number),
          memoryUsed: expect.any(String),
        },
        rag: {
          docCount: expect.any(Number),
          avgEmbedMs: null,
        },
        visitorsOnline: expect.any(Number),
        timestamp: expect.any(Number),
      });
    });

    it('timestamp is close to current time', async () => {
      const before = Date.now();
      const res = await request(app.getHttpServer()).get('/system/metrics');
      const after = Date.now();

      expect(res.body.timestamp).toBeGreaterThanOrEqual(before);
      expect(res.body.timestamp).toBeLessThanOrEqual(after);
    });

    it('db.activeConnections > 0 (real DB connected)', async () => {
      const res = await request(app.getHttpServer()).get('/system/metrics');
      expect(res.body.db.activeConnections).toBeGreaterThan(0);
    });

    it('api.uptimeSeconds is positive', async () => {
      const res = await request(app.getHttpServer()).get('/system/metrics');
      expect(res.body.api.uptimeSeconds).toBeGreaterThan(0);
    });

    it('rag.docCount reflects published KB documents in DB', async () => {
      await prisma.kBDocument.createMany({
        data: [
          fixtures.kbDocument({ title: 'Published Doc 1', published: true }),
          fixtures.kbDocument({ title: 'Published Doc 2', published: true }),
          fixtures.kbDocument({ title: 'Draft Doc', published: false }),
        ],
      });

      const res = await request(app.getHttpServer()).get('/system/metrics');
      // At least 2 published docs
      expect(res.body.rag.docCount).toBeGreaterThanOrEqual(2);
    });

    it('is unauthenticated (no auth required)', async () => {
      const res = await request(app.getHttpServer()).get('/system/metrics');
      expect(res.status).not.toBe(401);
    });
  });
});
