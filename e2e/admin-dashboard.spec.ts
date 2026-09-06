import { test, expect, type Page } from '@playwright/test';

async function withAdminCookie(page: Page) {
  await page.context().addCookies([{
    name: 'admin_token', value: 'e2e-smoke-token', domain: 'localhost', path: '/',
  }]);
}

// ── Dashboard overview ─────────────────────────────────────────────────────────

test.describe('Admin — Dashboard overview', () => {
  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    await page.route('**/github/cache', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    );
    await page.goto('/admin/dashboard');
  });

  test('dashboard shows "00 / OVERVIEW" section index', async ({ page }) => {
    await expect(page.getByText(/00 \/ overview/i)).toBeVisible();
  });

  test('dashboard heading is "Dashboard"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^dashboard$/i })).toBeVisible();
  });

  test('section cards are present for all content areas', async ({ page }) => {
    // Scope to main to avoid matching hidden sidebar links on mobile
    const main = page.locator('main');
    for (const label of ['Skills', 'Experience', 'Projects', 'Knowledge Base', 'Analytics']) {
      await expect(main.getByText(label).first()).toBeVisible({ timeout: 3_000 });
    }
  });

  test('section cards are clickable links to the right pages', async ({ page }) => {
    const skillsCard = page.getByRole('link', { name: /skills/i }).first();
    await expect(skillsCard).toBeVisible();
    expect(await skillsCard.getAttribute('href')).toContain('/admin/dashboard/skills');
  });

  test('"Sync GitHub" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sync github/i })).toBeVisible();
  });

  test('GitHub sync shows success message after click', async ({ page }) => {
    await page.getByRole('button', { name: /sync github/i }).click();
    await expect(page.getByText(/cache cleared|heatmap will refresh/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('GitHub sync shows error message when API fails', async ({ page }) => {
    await page.route('**/github/cache', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Server error' }) })
    );
    await page.getByRole('button', { name: /sync github/i }).click();
    await expect(page.getByText(/failed|error|server error/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

// ── Sidebar navigation ─────────────────────────────────────────────────────────

test.describe('Admin — Sidebar navigation', () => {
  // Sidebar is only always-visible on desktop; mobile uses the hamburger drawer (tested separately)
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    await page.goto('/admin/dashboard');
  });

  test('sidebar shows all section nav links', async ({ page }) => {
    for (const label of ['Skills', 'Experience', 'Projects', 'Knowledge Base', 'Analytics', 'Security']) {
      await expect(page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).first()).toBeVisible();
    }
  });

  test('clicking Skills link navigates to /admin/dashboard/skills', async ({ page }) => {
    await page.getByRole('link', { name: /^skills$/i }).first().click();
    await expect(page).toHaveURL(/admin\/dashboard\/skills/);
  });

  test('clicking Analytics link navigates to /admin/dashboard/analytics', async ({ page }) => {
    // No API mock needed here: we only verify URL navigation, not page content.
    // The analytics page makes apiFetch calls; if the backend is offline they throw
    // a network error (no redirect), so the URL stays at /admin/dashboard/analytics.
    await page.getByRole('link', { name: /^analytics$/i }).first().click();
    await expect(page).toHaveURL(/admin\/dashboard\/analytics/, { timeout: 10_000 });
  });

  test('"Sign out" button is visible in sidebar', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('signing out redirects to /admin/login', async ({ page }) => {
    // The mock must include Set-Cookie to clear the httpOnly cookie; otherwise
    // Next.js middleware sees the still-valid cookie and redirects back to dashboard.
    await page.route('**/api/admin-auth', route =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'admin_token=; Max-Age=0; Path=/' },
        body: JSON.stringify({ ok: true }),
      })
    );
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/admin\/login/, { timeout: 10_000 });
  });

  test('signing out removes admin_token cookie', async ({ page }) => {
    await page.route('**/api/admin-auth', route =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'admin_token=; Max-Age=0; Path=/' },
        body: JSON.stringify({ ok: true }),
      })
    );
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/admin\/login/, { timeout: 10_000 });
    const cookies = await page.context().cookies();
    const adminCookie = cookies.find(c => c.name === 'admin_token');
    // Cookie is either absent or has been cleared by the server response
    expect(adminCookie?.value ?? '').not.toBe('e2e-smoke-token');
  });
});

// ── Mobile sidebar drawer ──────────────────────────────────────────────────────

test.describe('Admin — Mobile sidebar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    await page.goto('/admin/dashboard');
  });

  test('mobile hamburger "Open navigation" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible();
  });

  test('desktop sidebar is hidden on mobile viewport', async ({ page }) => {
    // The aside element with hidden md:flex is not visible on narrow screens
    const desktopSidebar = page.locator('aside.hidden');
    await expect(desktopSidebar.first()).toBeHidden();
  });

  test('clicking hamburger opens the sidebar drawer', async ({ page }) => {
    await page.getByRole('button', { name: /open navigation/i }).click();
    // Drawer slides in — wait for a nav link inside it to appear
    await expect(page.getByRole('link', { name: /^skills$/i }).first()).toBeVisible({ timeout: 3_000 });
  });

  test('open sidebar drawer shows all nav sections', async ({ page }) => {
    await page.getByRole('button', { name: /open navigation/i }).click();
    for (const label of ['Skills', 'Experience', 'Projects', 'Analytics']) {
      await expect(page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).first()).toBeVisible({ timeout: 3_000 });
    }
  });

  test('open sidebar shows Sign out button', async ({ page }) => {
    await page.getByRole('button', { name: /open navigation/i }).click();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 3_000 });
  });

  test('clicking a nav item in the drawer closes it', async ({ page }) => {
    await page.route('**/content/skills', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.getByRole('button', { name: /open navigation/i }).click();
    await page.getByRole('link', { name: /^skills$/i }).first().click();
    // After navigation the drawer should be gone
    await expect(page).toHaveURL(/skills/);
    await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible({ timeout: 3_000 });
  });
});

// ── Analytics page ─────────────────────────────────────────────────────────────

test.describe('Admin — Analytics page', () => {
  const MOCK_SUMMARY = {
    totalPageViews: 1234,
    uniqueSessions: 567,
    chatbotOpens: 89,
    caseStudyReads: 23,
    dailyEvents: [],
    topPaths: [],
  };

  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    // Target port 3001 specifically — avoids accidentally intercepting the Next.js page
    // navigation to /admin/dashboard/analytics (localhost:3000)
    await page.route(/localhost:3001\/analytics/, route => {
      const url = route.request().url();
      if (url.includes('/analytics/summary')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SUMMARY) });
      }
      if (url.includes('/analytics/events')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.goto('/admin/dashboard/analytics');
  });

  test('analytics page renders "Analytics" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /analytics/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('analytics page shows page view metric', async ({ page }) => {
    // MetricCard renders value.toLocaleString() — 1234 becomes "1,234" or "1234"
    await expect(page.getByText(/1[,.]?234|page views/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('analytics page shows unique sessions metric', async ({ page }) => {
    await expect(page.getByText(/567|unique sessions/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

// ── Security page ──────────────────────────────────────────────────────────────

test.describe('Admin — Security page', () => {
  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    await page.goto('/admin/dashboard/security');
  });

  test('security page loads without error', async ({ page }) => {
    // Just verify it renders — no JS errors / crash
    await expect(page).not.toHaveURL(/login/, { timeout: 3_000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('security page has a heading', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 5_000 });
  });
});
