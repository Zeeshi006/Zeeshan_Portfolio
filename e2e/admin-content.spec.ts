import { test, expect, type Page } from '@playwright/test';

async function withAdminCookie(page: Page) {
  await page.context().addCookies([{
    name: 'admin_token', value: 'e2e-smoke-token', domain: 'localhost', path: '/',
  }]);
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_SKILLS = [
  { id: 's1', name: 'NestJS', category: 'backend', proficiencyLevel: 5, sortOrder: 0 },
  { id: 's2', name: 'PostgreSQL', category: 'data', proficiencyLevel: 4, sortOrder: 1 },
];

const MOCK_PROJECTS = [
  { id: 'p1', title: 'Sales CRM', slug: 'sales-crm', tagline: 'Real-time CRM', techStack: ['NestJS'], outcomeMetric: '10k users', status: 'shipped', featured: true, sortOrder: 0 },
];

const MOCK_EXPERIENCES = [
  { id: 'e1', company: 'TapTap Technologies', role: 'Backend Engineer', startDate: '2022-01-01', endDate: null, summary: 'Built APIs', highlights: ['Redis'], sortOrder: 0 },
];

const MOCK_KB = [
  { id: 'k1', title: 'Stack Overview', content: 'Uses NestJS...', published: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

// ── Skills ─────────────────────────────────────────────────────────────────────

test.describe('Admin — Skills CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    await page.route('**/content/skills', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SKILLS) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 's3', name: 'Redis', category: 'backend', proficiencyLevel: 3, sortOrder: 2 }) });
    });
    await page.route('**/content/skills/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    );
    await page.goto('/admin/dashboard/skills');
  });

  test('skills page renders heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /skills/i }).first()).toBeVisible();
  });

  test('table shows Name, Category, Level column headers', async ({ page }) => {
    await expect(page.getByText('Name').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
    await expect(page.getByText('Level').first()).toBeVisible();
  });

  test('mock skills appear in the table', async ({ page }) => {
    await expect(page.getByText('NestJS')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('PostgreSQL')).toBeVisible({ timeout: 5_000 });
  });

  test('"+ Add Skill" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add skill/i })).toBeVisible();
  });

  test('clicking "+ Add Skill" reveals a form', async ({ page }) => {
    await page.getByRole('button', { name: /add skill/i }).click();
    await expect(page.locator('form')).toBeVisible();
  });

  test('form has Save and Cancel buttons', async ({ page }) => {
    await page.getByRole('button', { name: /add skill/i }).click();
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^cancel$/i })).toBeVisible();
  });

  test('Cancel hides the form', async ({ page }) => {
    await page.getByRole('button', { name: /add skill/i }).click();
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.locator('form')).not.toBeVisible({ timeout: 2_000 });
  });

  test('saving a new skill calls API and closes form', async ({ page }) => {
    await page.getByRole('button', { name: /add skill/i }).click();
    // Fill the name field (first text input in the form)
    const nameInput = page.locator('form input').first();
    await nameInput.fill('Redis');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.locator('form')).not.toBeVisible({ timeout: 5_000 });
  });

  test('Edit button opens a pre-filled form showing "Edit Skill"', async ({ page }) => {
    await page.getByRole('button', { name: /^edit$/i }).first().click();
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByText(/edit skill/i)).toBeVisible();
  });

  test('Delete button triggers a confirm dialog', async ({ page }) => {
    let dialogShown = false;
    page.on('dialog', dialog => { dialogShown = true; void dialog.dismiss(); });
    await page.getByRole('button', { name: /^delete$/i }).first().click();
    await page.waitForTimeout(400);
    expect(dialogShown).toBe(true);
  });

  test('dismissing the delete confirm keeps the row in the table', async ({ page }) => {
    page.on('dialog', dialog => void dialog.dismiss());
    await page.getByRole('button', { name: /^delete$/i }).first().click();
    await page.waitForTimeout(400);
    await expect(page.getByText('NestJS')).toBeVisible();
  });
});

// ── Projects ───────────────────────────────────────────────────────────────────

test.describe('Admin — Projects CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    await page.route('**/content/projects', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROJECTS) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/content/projects/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    );
    await page.goto('/admin/dashboard/projects');
  });

  test('projects page renders heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /projects/i }).first()).toBeVisible();
  });

  test('mock project appears in the table', async ({ page }) => {
    await expect(page.getByText('Sales CRM')).toBeVisible({ timeout: 5_000 });
  });

  test('"+ Add" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^\+ add$/i })).toBeVisible();
  });

  test('clicking "+ Add" reveals a form', async ({ page }) => {
    await page.getByRole('button', { name: /^\+ add$/i }).click();
    await expect(page.locator('form')).toBeVisible();
  });

  test('add form has Title and Slug labels', async ({ page }) => {
    await page.getByRole('button', { name: /^\+ add$/i }).click();
    await expect(page.locator('form')).toBeVisible({ timeout: 5_000 });
    // On narrow mobile viewports the form can extend below the fold; use toBeAttached
    // (DOM presence) to confirm the fields exist without depending on scroll position.
    await expect(page.locator('form label').filter({ hasText: /^title$/i }).first()).toBeAttached({ timeout: 5_000 });
    await expect(page.locator('form label').filter({ hasText: /^slug$/i }).first()).toBeAttached({ timeout: 5_000 });
  });

  test('Edit button opens the form', async ({ page }) => {
    await page.getByRole('button', { name: /^edit$/i }).first().click();
    await expect(page.locator('form')).toBeVisible();
  });

  test('Delete button triggers confirm dialog', async ({ page }) => {
    let dialogShown = false;
    page.on('dialog', dialog => { dialogShown = true; void dialog.dismiss(); });
    await page.getByRole('button', { name: /^delete$/i }).first().click();
    await page.waitForTimeout(400);
    expect(dialogShown).toBe(true);
  });
});

// ── Experience ─────────────────────────────────────────────────────────────────

test.describe('Admin — Experience CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    await page.route('**/content/experiences', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXPERIENCES) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/content/experiences/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    );
    await page.goto('/admin/dashboard/experience');
  });

  test('experience page renders heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /experience/i }).first()).toBeVisible();
  });

  test('mock experience entry appears in the table', async ({ page }) => {
    await expect(page.getByText('TapTap Technologies')).toBeVisible({ timeout: 5_000 });
  });

  test('Add button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add/i }).first()).toBeVisible();
  });

  test('clicking Add reveals a form', async ({ page }) => {
    await page.getByRole('button', { name: /add/i }).first().click();
    await expect(page.locator('form')).toBeVisible();
  });

  test('Edit button opens a pre-filled form', async ({ page }) => {
    await page.getByRole('button', { name: /^edit$/i }).first().click();
    await expect(page.locator('form')).toBeVisible();
  });
});

// ── Knowledge Base ─────────────────────────────────────────────────────────────

test.describe('Admin — Knowledge Base CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await withAdminCookie(page);
    await page.route('**/chat/kb', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_KB) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'k2' }) });
    });
    await page.route('**/chat/kb/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    );
    await page.goto('/admin/dashboard/knowledge-base');
  });

  test('knowledge base page renders "Knowledge Base" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /knowledge base/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('mock KB document appears in the list', async ({ page }) => {
    await expect(page.getByText('Stack Overview')).toBeVisible({ timeout: 5_000 });
  });

  test('"+ Add Document" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /\+ add document/i })).toBeVisible({ timeout: 3_000 });
  });

  test('clicking "+ Add Document" shows a form with textarea', async ({ page }) => {
    await page.getByRole('button', { name: /\+ add document/i }).click();
    await expect(page.locator('form textarea').first()).toBeVisible({ timeout: 3_000 });
  });

  test('form has "New Document" label', async ({ page }) => {
    await page.getByRole('button', { name: /\+ add document/i }).click();
    await expect(page.getByText(/new document/i)).toBeVisible();
  });

  test('Cancel hides the form', async ({ page }) => {
    await page.getByRole('button', { name: /\+ add document/i }).click();
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.locator('form')).not.toBeVisible({ timeout: 2_000 });
  });

  test('Delete button triggers confirm dialog', async ({ page }) => {
    let dialogShown = false;
    page.on('dialog', dialog => { dialogShown = true; void dialog.dismiss(); });
    await page.getByRole('button', { name: /^delete$/i }).first().click();
    await page.waitForTimeout(400);
    expect(dialogShown).toBe(true);
  });
});
