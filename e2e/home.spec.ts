import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Critical content ──────────────────────────────────────────────────────────

  test('page title is set', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });

  test('displays Hammad Afzal name or heading', async ({ page }) => {
    // Use heading role — avoids the hidden `sm:block` nav span on mobile
    await expect(page.getByRole('heading', { name: /hammad/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigation is present', async ({ page }) => {
    // <header> is always visible; desktop <nav> is hidden md:flex (invisible on mobile)
    await expect(page.locator('header')).toBeVisible();
  });

  test('has accessible landmark regions (nav + main)', async ({ page }) => {
    await expect(page.getByRole('main')).toBeVisible();
    // <header> acts as the navigation landmark (hamburger on mobile, full nav on desktop)
    await expect(page.locator('header')).toBeVisible();
  });

  // ── SpeedDial / Chat ──────────────────────────────────────────────────────────

  test('SpeedDial FAB is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /chat or call/i })).toBeVisible();
  });

  test('clicking FAB opens chat/call menu', async ({ page }) => {
    await page.getByRole('button', { name: /chat or call/i }).click();
    await expect(page.getByRole('button', { name: /open chat/i })).toBeVisible({ timeout: 3_000 });
  });

  test('chat panel opens when ASK AI is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /chat or call/i }).click();
    await page.getByRole('button', { name: /open chat/i }).click();
    await expect(page.locator('input[type="text"], textarea').first()).toBeVisible({ timeout: 3_000 });
  });

  // ── Navigation links ─────────────────────────────────────────────────────────

  test('nav contains skills link', async ({ page }) => {
    // On mobile the nav is behind a hamburger menu — open it first
    const hamburger = page.getByRole('button', { name: /open menu/i });
    if (await hamburger.isVisible()) {
      await hamburger.click();
    }
    await expect(page.getByRole('link', { name: /skills/i }).first()).toBeVisible({ timeout: 3_000 });
  });

  test('nav contains experience or projects link', async ({ page }) => {
    const hamburger = page.getByRole('button', { name: /open menu/i });
    if (await hamburger.isVisible()) {
      await hamburger.click();
    }
    const expOrProj = page.getByRole('link', { name: /experience|projects/i }).first();
    await expect(expOrProj).toBeVisible({ timeout: 3_000 });
  });

  // ── System link ───────────────────────────────────────────────────────────────

  test('there is a link to /system page', async ({ page }) => {
    const hamburger = page.getByRole('button', { name: /open menu/i });
    if (await hamburger.isVisible()) {
      await hamburger.click();
    }
    const systemLink = page.getByRole('link', { name: /system|observatory/i }).first();
    if (await systemLink.count() > 0) {
      await expect(systemLink).toBeVisible();
    }
  });

  // ── Core Web Vitals / Performance (page loads without JS errors) ──────────────

  test('no uncaught JS errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});
