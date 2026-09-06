import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startContainers, stopContainers } from '../../test/containers';
import { buildTestApp } from '../../test/app-helper';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { fixtures } from '../../test/fixtures';

jest.setTimeout(120_000);

async function loginAdmin(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send(fixtures.adminCredentials);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return (res.body as { access_token: string }).access_token;
}

describe('AnalyticsController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    await startContainers();
    app = await buildTestApp();
    prisma = app.get(PrismaService);
    token = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
    await stopContainers();
  });

  beforeEach(async () => {
    await prisma.analyticsEvent.deleteMany();
  });

  // ── POST /analytics/collect ──────────────────────────────────────────────────

  describe('POST /analytics/collect', () => {
    it('returns 204 for valid page_view event', async () => {
      const res = await request(app.getHttpServer())
        .post('/analytics/collect')
        .send(fixtures.analyticsEvent());

      expect(res.status).toBe(204);
    });

    it('persists the event to the database', async () => {
      const dto = fixtures.analyticsEvent({ type: 'cta_click', path: '/contact' });
      await request(app.getHttpServer()).post('/analytics/collect').send(dto);

      const events = await prisma.analyticsEvent.findMany({ where: { type: 'cta_click' } });
      expect(events.length).toBe(1);
      expect(events[0]?.path).toBe('/contact');
    });

    it('returns 400 for unknown event type', async () => {
      const res = await request(app.getHttpServer())
        .post('/analytics/collect')
        .send({ type: 'INVALID_EVENT', path: '/', sessionId: 'sess-001' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing sessionId', async () => {
      const res = await request(app.getHttpServer())
        .post('/analytics/collect')
        .send({ type: 'page_view', path: '/' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing type', async () => {
      const res = await request(app.getHttpServer())
        .post('/analytics/collect')
        .send({ path: '/', sessionId: 'sess-001' });

      expect(res.status).toBe(400);
    });

    it('accepts optional metadata', async () => {
      const res = await request(app.getHttpServer())
        .post('/analytics/collect')
        .send({ type: 'section_view', path: '/', sessionId: 'sess-meta-001', metadata: { scrollDepth: 80 } });

      expect(res.status).toBe(204);
    });

    it('accepts optional section field', async () => {
      const res = await request(app.getHttpServer())
        .post('/analytics/collect')
        .send({ type: 'section_view', path: '/', sessionId: 'sess-002', section: 'experience' });

      expect(res.status).toBe(204);
    });

    it('rejects extra (non-whitelisted) fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/analytics/collect')
        .send({ type: 'page_view', path: '/', sessionId: 'sess-003', EXTRA_FIELD: 'bad' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /analytics/summary ───────────────────────────────────────────────────

  describe('GET /analytics/summary', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/analytics/summary');
      expect(res.status).toBe(401);
    });

    it('returns 200 with correct summary shape when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalPageViews: expect.any(Number),
        uniqueSessions: expect.any(Number),
        topPaths: expect.any(Array),
        eventsByDay: expect.any(Array),
        chatbotOpens: expect.any(Number),
        caseStudyReads: expect.any(Number),
      });
    });

    it('counts page_view events correctly', async () => {
      // Seed 3 page_view events
      await prisma.analyticsEvent.createMany({
        data: [
          fixtures.analyticsEvent({ sessionId: 'sess-a', path: '/' }),
          fixtures.analyticsEvent({ sessionId: 'sess-b', path: '/projects' }),
          fixtures.analyticsEvent({ sessionId: 'sess-c', path: '/' }),
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.totalPageViews).toBeGreaterThanOrEqual(3);
    });
  });

  // ── GET /analytics/events ────────────────────────────────────────────────────

  describe('GET /analytics/events', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/analytics/events');
      expect(res.status).toBe(401);
    });

    it('returns paginated events with correct shape', async () => {
      await prisma.analyticsEvent.createMany({
        data: [
          fixtures.analyticsEvent({ sessionId: 'pg-1' }),
          fixtures.analyticsEvent({ sessionId: 'pg-2' }),
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/analytics/events')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: expect.any(Number),
      });
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });

    it('respects page and limit query params', async () => {
      await prisma.analyticsEvent.createMany({
        data: Array.from({ length: 15 }, (_, i) =>
          fixtures.analyticsEvent({ sessionId: `bulk-${i}` }),
        ),
      });

      const res = await request(app.getHttpServer())
        .get('/analytics/events?page=1&limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });
  });
});
