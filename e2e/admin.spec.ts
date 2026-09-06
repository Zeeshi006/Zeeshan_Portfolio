import { test, expect } from '@playwright/test';

const ADMIN_EMAIL    = process.env['E2E_ADMIN_EMAIL']    ?? 'admin@test.com';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'Admin@1234';

test.describe('Admin panel', () => {

  // ── Login page ────────────────────────────────────────────────────────────────

  test.describe('Login page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/login');
    });

    test('login page renders with email and password inputs', async ({ page }) => {
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('login page has a submit button', async ({ page }) => {
      const submitBtn = page.getByRole('button', { name: /sign in with password/i });
      await expect(submitBtn).toBeVisible();
    });

    test('shows error on invalid credentials', async ({ page }) => {
      // Mock the login API to immediately return 401 so the error message appears
      await page.route('**/api/admin-login', route =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid credentials. Please try again.' }),
        })
      );

      // Use pressSequentially so React state updates synchronously on each keystroke
      const emailInput = page.locator('input[type="email"]');
      await emailInput.click();
      await emailInput.pressSequentially('wrong@example.com');
      const passInput = page.locator('input[type="password"]');
      await passInput.click();
      await passInput.pressSequentially('wrongpassword');
      await page.getByRole('button', { name: /sign in with password/i }).click();

      await expect(
        page.getByText(/invalid|incorrect|error|failed|credentials/i).first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test('unauthenticated visit to /admin/dashboard redirects to login', async ({ page }) => {
      await page.goto('/admin/dashboard');
      await expect(page).toHaveURL(/login/, { timeout: 5_000 });
    });

    test('unauthenticated visit to /admin redirects to login', async ({ page }) => {
      await page.goto('/admin');
      const url = page.url();
      const isRedirected = url.includes('/login') || url.includes('/admin/login');
      const loginPrompt = (await page.getByRole('button', { name: /sign in with password/i }).count()) > 0;
      expect(isRedirected || loginPrompt).toBe(true);
    });

    test('passkey button is visible on login page', async ({ page }) => {
      const passkeyBtn = page.getByRole('button', { name: /passkey|biometric|touch id|face id|windows hello/i });
      await expect(passkeyBtn).toBeVisible();
    });
  });

  // ── Authenticated flow ────────────────────────────────────────────────────────

  test.describe('Authenticated admin', () => {
    test.beforeEach(async ({ page }) => {
      // Set the auth cookie directly so Next.js middleware allows /admin/dashboard.
      // Going through the real login form would require a running NestJS backend;
      // we test the login form separately above.
      await page.context().addCookies([{
        name: 'admin_token',
        value: 'e2e-smoke-token',
        domain: 'localhost',
        path: '/',
      }]);
    });

    test('successful login redirects to /admin/dashboard', async ({ page }) => {
      // Middleware: authenticated user visiting /admin/login → redirect to dashboard
      await page.goto('/admin/login');
      await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 10_000 });
    });

    test('dashboard shows navigation links', async ({ page }) => {
      await page.goto('/admin/dashboard');
      await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 5_000 });
      const navLinks = page.getByRole('link').first();
      await expect(navLinks).toBeVisible({ timeout: 5_000 });
    });
  });
});
