import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startContainers, stopContainers } from '../../test/containers';
import { buildTestApp } from '../../test/app-helper';
import { PrismaService } from '../../infrastructure/database/prisma.service';

jest.setTimeout(120_000);

const validContact = {
  name: 'Test User',
  email: 'test@example.com',
  message: 'Hello, I saw your portfolio and would like to connect.',
};

describe('ContactController (integration)', () => {
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
  });

  // ── POST /contact ────────────────────────────────────────────────────────────

  describe('POST /contact', () => {
    it('returns 200 with { ok: true } for valid submission', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send(validContact);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('persists submission as contact_form analytics event', async () => {
      await request(app.getHttpServer()).post('/contact').send(validContact);

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'contact_form' },
      });
      expect(events.length).toBe(1);

      const meta = events[0]?.metadata as Record<string, unknown>;
      expect(meta['email']).toBe('test@example.com');
      expect(meta['name']).toBe('Test User');
    });

    it('stores name, email, and message in metadata', async () => {
      const dto = { name: 'Jane Doe', email: 'jane@example.com', message: 'Interested in your work!' };
      await request(app.getHttpServer()).post('/contact').send(dto);

      const event = await prisma.analyticsEvent.findFirst({ where: { type: 'contact_form' } });
      const meta = event?.metadata as Record<string, unknown>;
      expect(meta['name']).toBe('Jane Doe');
      expect(meta['email']).toBe('jane@example.com');
      expect(meta['message']).toBe('Interested in your work!');
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send({ ...validContact, email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing name', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send({ email: 'test@example.com', message: 'Hello' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing message', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send({ name: 'Test', email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for name exceeding 120 chars', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send({ ...validContact, name: 'A'.repeat(121) });

      expect(res.status).toBe(400);
    });

    it('returns 400 for message exceeding 2000 chars', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send({ ...validContact, message: 'x'.repeat(2001) });

      expect(res.status).toBe(400);
    });

    it('accepts message exactly at 2000 char limit', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send({ ...validContact, message: 'x'.repeat(2000) });

      expect(res.status).toBe(200);
    });

    it('works without RESEND_API_KEY (graceful email skip)', async () => {
      // containers.ts does not set RESEND_API_KEY, so this tests the no-email path
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send(validContact);

      // Still persists to DB and returns ok
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('is unauthenticated (no auth required)', async () => {
      const res = await request(app.getHttpServer())
        .post('/contact')
        .send(validContact);

      expect(res.status).not.toBe(401);
    });
  });
});
