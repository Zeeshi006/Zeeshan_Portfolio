import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startContainers, stopContainers } from '../../test/containers';
import { buildTestApp } from '../../test/app-helper';
import { fixtures } from '../../test/fixtures';

jest.setTimeout(120_000);

describe('AuthController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await startContainers();
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await stopContainers();
  });

  // ── POST /auth/login ─────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 200 with access_token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(fixtures.adminCredentials);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ access_token: expect.any(String) });
    });

    it('returned token is a non-empty string', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(fixtures.adminCredentials);

      expect((res.body as { access_token: string }).access_token.length).toBeGreaterThan(20);
    });

    it('returned token is a valid JWT (3 base64 segments)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(fixtures.adminCredentials);

      const parts = (res.body as { access_token: string }).access_token.split('.');
      expect(parts.length).toBe(3);
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminCredentials.email, password: 'WrongPassword123' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'SomePassword1' });

      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'Admin@1234' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for password shorter than 8 chars', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminCredentials.email, password: 'short' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'Admin@1234' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminCredentials.email });

      expect(res.status).toBe(400);
    });

    it('token can be used to access protected analytics/summary', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(fixtures.adminCredentials);

      const { access_token } = loginRes.body as { access_token: string };
      const summaryRes = await request(app.getHttpServer())
        .get('/analytics/summary')
        .set('Authorization', `Bearer ${access_token}`);

      expect(summaryRes.status).toBe(200);
    });

    it('returns 401 when protected route accessed without token', async () => {
      const res = await request(app.getHttpServer()).get('/analytics/summary');
      expect(res.status).toBe(401);
    });
  });
});
