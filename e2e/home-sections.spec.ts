import { test, expect } from '@playwright/test';

test.describe('Home page — content sections', () => {
  test.beforeEach(async ({ page }) => {
    // Disable animations so SectionReveal (Framer Motion whileInView) renders elements
    // immediately instead of starting at opacity:0 until scrolled into view.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
  });

  // ── Hero CTAs ─────────────────────────────────────────────────────────────────

  test('hero has "View Work" CTA link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /view work/i })).toBeVisible();
  });

  test('hero has "Get in Touch" CTA link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /get in touch/i })).toBeVisible();
  });

  // ── About ─────────────────────────────────────────────────────────────────────

  test('about section exists with id="about"', async ({ page }) => {
    await expect(page.locator('#about')).toBeAttached();
  });

  test('about section contains engineering narrative text', async ({ page }) => {
    const about = page.locator('#about');
    await expect(about.getByText(/solve|engineer|backend|real.time|ai/i).first()).toBeVisible({ timeout: 5_000 });
  });

  // ── Skills ────────────────────────────────────────────────────────────────────

  test('skills section heading "What I work with" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /what i work with/i })).toBeVisible({ timeout: 5_000 });
  });

  // ── Experience ────────────────────────────────────────────────────────────────

  test('experience section heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /where.*worked/i })).toBeVisible({ timeout: 5_000 });
  });

  // ── Projects ─────────────────────────────────────────────────────────────────

  test('projects section heading "Selected work" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /selected work/i })).toBeVisible({ timeout: 5_000 });
  });

  test('projects section index "03 / PROJECTS" is in the DOM', async ({ page }) => {
    // Use toBeAttached (DOM presence) — the p.section-index may be in a SectionReveal
    // that hasn't animated into view yet; presence is enough to confirm the section rendered.
    await expect(page.getByText(/03 \/ projects/i).first()).toBeAttached({ timeout: 5_000 });
  });

  // ── GitHub Activity ───────────────────────────────────────────────────────────

  test('GitHub section renders gracefully whether or not the API is available', async ({ page }) => {
    // GitHub component returns null when data is null (API offline in E2E).
    // Verify the rest of the page still loads — Availability is always below GitHub.
    await expect(page.getByRole('heading', { name: /available for hire/i })).toBeVisible({ timeout: 5_000 });
  });

  // ── Availability ──────────────────────────────────────────────────────────────

  test('availability section heading "Available for hire" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /available for hire/i })).toBeVisible({ timeout: 5_000 });
  });

  test('availability section shows "same business day" response time', async ({ page }) => {
    await expect(page.getByText(/same business day/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('availability section shows location', async ({ page }) => {
    await expect(page.getByText(/karachi|pakistan|PKT/i).first()).toBeVisible({ timeout: 5_000 });
  });

  // ── Contact ───────────────────────────────────────────────────────────────────

  test('contact section has email copy button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /copy email/i })).toBeVisible();
  });

  test('contact section has WhatsApp link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /whatsapp/i })).toBeVisible();
  });

  test('contact section has LinkedIn link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /linkedin/i })).toBeVisible();
  });

  test('contact has resume download link', async ({ page }) => {
    // Two resume links exist (nav chip + contact card); use first() to avoid strict-mode error
    const link = page.getByRole('link', { name: /resume|download pdf/i }).first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/resume/i);
  });

  // ── Footer ────────────────────────────────────────────────────────────────────

  test('footer shows copyright with year', async ({ page }) => {
    await expect(page.getByText(/© \d{4} Hammad Afzal/)).toBeVisible();
  });

  test('footer mentions NestJS', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer.getByText(/nestjs/i).first()).toBeVisible();
  });

  test('footer has live Swagger link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /live swagger/i })).toBeVisible();
  });

  test('footer source link points to GitHub', async ({ page }) => {
    const link = page.getByRole('link', { name: /^source$/i });
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain('github');
  });

  // ── SEO ───────────────────────────────────────────────────────────────────────

  test('page has meta description', async ({ page }) => {
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
    expect(desc!.length).toBeGreaterThan(20);
  });

  test('meta description mentions backend engineering', async ({ page }) => {
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toMatch(/backend|engineer|nestjs|ai/i);
  });

  test('page has OG title containing "Hammad"', async ({ page }) => {
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toMatch(/hammad/i);
  });

  test('page has OG description', async ({ page }) => {
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(ogDesc).toBeTruthy();
    expect(ogDesc!.length).toBeGreaterThan(10);
  });

  // ── Nav scroll behaviour ──────────────────────────────────────────────────────

  test('scrolling down increases window.scrollY', async ({ page }) => {
    await page.locator('#about').scrollIntoViewIfNeeded();
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  // ── Section availability status text ─────────────────────────────────────────

  test('availability section shows open-to-work status', async ({ page }) => {
    await expect(page.getByText(/open to|available immediately/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
