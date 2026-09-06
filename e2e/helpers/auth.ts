import type { Page } from '@playwright/test';

const ADMIN_EMAIL    = process.env['E2E_ADMIN_EMAIL']    ?? 'admin@test.com';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'Admin@1234';

/**
 * Logs in as admin via the login form and waits for the dashboard redirect.
 * Caches auth state in browser storage so subsequent calls in the same test are fast.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');

  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in|login|continue/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/admin/dashboard', { timeout: 10_000 });
}

/**
 * Returns stored admin JWT from cookie/session for API calls in tests.
 * Call after loginAsAdmin().
 */
export async function getAdminToken(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  const adminCookie = cookies.find(c => c.name === 'admin_token' || c.name === 'auth_token');
  return adminCookie?.value;
}
