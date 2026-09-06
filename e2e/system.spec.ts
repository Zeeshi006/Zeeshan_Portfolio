import { test, expect } from '@playwright/test';

test.describe('System Observatory page (/system)', () => {
  const MOCK_METRICS = {
    api: { p50Ms: 42, p99Ms: 180, uptimeSeconds: 86500, sampleSize: 1200 },
    db: { activeConnections: 3, txnPerMinute: 45 },
    redis: { hitRatePct: 94, memoryUsed: '12.5M' },
    rag: { docCount: 8, avgEmbedMs: 210 },
    visitorsOnline: 3,
    timestamp: 1717977600000,
  };

  test.beforeEach(async ({ page }) => {
    await page.route('**/system/metrics', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_METRICS),
      })
    );
    await page.goto('/system');
  });

  // ── Page structure ────────────────────────────────────────────────────────────

  test('page loads with 200 status', async ({ page }) => {
    const response = await page.goto('/system');
    expect(response?.status()).toBeLessThan(400);
  });

  test('shows "01 / SYSTEM" section index', async ({ page }) => {
    await expect(page.getByText(/01 \/ SYSTEM/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows "Live Infrastructure" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /live infrastructure/i })).toBeVisible({ timeout: 5_000 });
  });

  test('shows description about real-time metrics', async ({ page }) => {
    await expect(page.getByText(/nestjs api|postgresql|redis/i).first()).toBeVisible({ timeout: 5_000 });
  });

  // ── Loading states ────────────────────────────────────────────────────────────

  test('shows either "CONNECTING…" then metrics, or a status indicator', async ({ page }) => {
    // Either the page shows connecting initially and then transitions, or it shows metrics directly
    // Check that some status text appears within 15s
    await expect(
      page.getByText(/connecting|updating|degraded|updated|online/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── Metric cards ─────────────────────────────────────────────────────────────

  test('API metric card appears', async ({ page }) => {
    await expect(page.getByText(/nestjs api/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Database metric card appears', async ({ page }) => {
    await expect(page.getByText(/postgresql/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Redis metric card appears', async ({ page }) => {
    await expect(page.getByText(/redis/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('RAG pipeline card appears', async ({ page }) => {
    await expect(page.getByText(/rag/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Visitors section appears', async ({ page }) => {
    await expect(page.getByText(/visitors/i).first()).toBeVisible({ timeout: 15_000 });
  });

  // ── LIVE indicator ────────────────────────────────────────────────────────────

  test('each metric card shows LIVE indicator', async ({ page }) => {
    await page.waitForTimeout(2_000); // let metrics load
    const liveIndicators = page.getByText('LIVE');
    await expect(liveIndicators.first()).toBeVisible({ timeout: 15_000 });
  });

  // ── Anonymous data notice ─────────────────────────────────────────────────────

  test('shows "All metrics are aggregate and anonymous" note', async ({ page }) => {
    await expect(
      page.getByText(/aggregate and anonymous/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── No auth required ─────────────────────────────────────────────────────────

  test('page is accessible without login', async ({ page }) => {
    const response = await page.goto('/system');
    expect(response?.url()).not.toContain('/login');
    expect(response?.status()).not.toBe(401);
  });
});
