# Testing Implementation Plan

> Work through phases in order. Each phase has a clear goal, exact files to create/modify, commands to run, and a done criterion. Do not start the next phase until the current one passes.

---

## Phase 1 — Foundation: Install & Configure

**Goal:** Every tool installed, zero tests written yet, but `pnpm test` runs and exits cleanly.

### 1.1 Install dependencies

```bash
# Backend
pnpm --filter api add -D \
  @nestjs/testing \
  supertest @types/supertest \
  jest-mock-extended \
  @testcontainers/postgresql \
  @testcontainers/redis \
  ts-jest

# Frontend
pnpm --filter web add -D \
  vitest \
  @vitejs/plugin-react \
  jsdom \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  @vitest/coverage-istanbul

# E2E (root)
pnpm add -D -w @playwright/test
npx playwright install --with-deps chromium
```

### 1.2 Files to create

```
services/api/
  jest.config.ts
  jest.setup.ts
  src/test/
    containers.ts        ← Testcontainers setup (real PG + Redis)
    fixtures.ts          ← shared test data factories
    app-helper.ts        ← bootstrap NestJS test app once per suite

apps/web/
  vitest.config.ts
  src/test/
    setup.ts             ← jest-dom matchers + global fetch mock

e2e/                     ← root level
  playwright.config.ts
  home.spec.ts
  chat.spec.ts
  system.spec.ts
  contact.spec.ts
  admin.spec.ts
```

### 1.3 `services/api/jest.config.ts`

```ts
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '../tsconfig.json' }] },
  setupFilesAfterFramework: ['<rootDir>/../jest.setup.ts'],
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.dto.ts',     // DTOs covered implicitly via controller tests
    '!**/prisma/**',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global:                              { lines: 90, functions: 90, branches: 85 },
    './modules/chat/application/':       { lines: 95 },
    './modules/auth/':                   { lines: 95 },
    './modules/observability/':          { lines: 90 },
  },
  testEnvironment: 'node',
  testTimeout: 30_000,
};
```

### 1.4 `services/api/jest.setup.ts`

```ts
// Silence console.warn/error in tests unless DEBUG_TESTS=1
if (!process.env['DEBUG_TESTS']) {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
}
```

### 1.5 `services/api/src/test/containers.ts`

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';

let pg: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;

export async function startContainers() {
  [pg, redis] = await Promise.all([
    new PostgreSqlContainer('pgvector/pgvector:pg17').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);

  process.env['DATABASE_URL'] = pg.getConnectionUri() + '?schema=public';
  process.env['REDIS_URL']    = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  // Run real Prisma migrations — catches migration errors early
  execSync('npx prisma migrate deploy', {
    cwd: process.cwd().includes('services/api') ? process.cwd() : 'services/api',
    env: { ...process.env },
    stdio: 'pipe',
  });
}

export async function stopContainers() {
  await Promise.all([pg?.stop(), redis?.stop()]);
}
```

### 1.6 `services/api/src/test/fixtures.ts`

```ts
// Shared test data factories — deterministic, no random IDs
export const fixtures = {
  skill: (overrides = {}) => ({
    name: 'NestJS',
    category: 'Backend',
    proficiencyLevel: 5,
    sortOrder: 0,
    ...overrides,
  }),

  kbDocument: (overrides = {}) => ({
    title: 'Test KB Doc',
    content: 'Hammad has 3 years of NestJS experience.',
    published: true,
    metadata: {},
    ...overrides,
  }),

  analyticsEvent: (overrides = {}) => ({
    type: 'page_view' as const,
    path: '/',
    sessionId: 'test-session-001',
    metadata: {},
    ...overrides,
  }),
};
```

### 1.7 `apps/web/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['**/*.stories.*', '**/test/**', '**/*.config.*', '**/layout.tsx'],
      thresholds: { lines: 90, functions: 90, branches: 85 },
    },
  },
});
```

### 1.8 `apps/web/src/test/setup.ts`

```ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Default: all fetch calls return 200 OK with empty body
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
} as Response);

// Silence Next.js router warnings in tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));
```

### 1.9 Add scripts to `package.json` files

**`services/api/package.json`** — add:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:cov": "jest --coverage",
"test:e2e": "jest --config jest-e2e.config.ts"
```

**`apps/web/package.json`** — add:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:cov": "vitest run --coverage",
"test:e2e": "playwright test"
```

**Root `package.json`** — add:
```json
"test": "turbo run test",
"test:cov": "turbo run test:cov",
"test:e2e": "playwright test"
```

### Done criterion
- `pnpm --filter api test` → "No tests found" (not an error)
- `pnpm --filter web test` → "No tests found"
- Testcontainers pulls images successfully

---

## Phase 2 — Backend Unit Tests

**Goal:** All NestJS use-cases and services covered with pure unit tests. No DB, no Redis — pure logic with mocked dependencies. Target: **~50% backend coverage**.

### Files to create

```
services/api/src/
  modules/
    chat/
      application/
        use-cases/
          answer-question.use-case.spec.ts
          ingest-document.use-case.spec.ts
        services/
          spend-guard.service.spec.ts
          rate-limit.service.spec.ts
          intent-filter.service.spec.ts
          answer-cache.service.spec.ts
    observability/
      application/
        metrics-collector.service.spec.ts
      infrastructure/
        latency.interceptor.spec.ts
    auth/
      application/
        services/
          passkey.service.spec.ts
    analytics/
      analytics.controller.spec.ts
    contact/
      contact.controller.spec.ts
```

### Key test cases per file

**`answer-question.use-case.spec.ts`**
- Returns grounded answer when KB has matching documents
- Returns "I don't have that info" message when KB is empty
- Respects chat history (passes it to LLM)
- Throws when LLM adapter rejects
- Correctly formats source chips in response

**`spend-guard.service.spec.ts`**
- `isDailyLimitExceeded()` returns `false` when spend is below threshold
- Returns `true` when spend exceeds `DAILY_TOKEN_LIMIT`
- Reads from Redis key, returns `false` on Redis error (fail open)

**`rate-limit.service.spec.ts`**
- Allows requests within window
- Blocks IP after exceeding per-IP limit
- Blocks session after exceeding per-session limit
- `limitType` is `'ip'` or `'session'` accordingly
- Window resets after TTL

**`metrics-collector.service.spec.ts`**
- `collect()` returns correct shape when Redis + Prisma return data
- `collectApi()` calculates p50/p99 correctly from sorted sample list
- `calcTxnRate()` returns 0 on first call (no prior snapshot)
- `calcTxnRate()` returns correct rate on second call
- Each `collect*()` method returns safe fallback on error

**`latency.interceptor.spec.ts`**
- Skips WebSocket context (`context.getType() === 'ws'`)
- Records timing to Redis after HTTP request completes
- Uses LPUSH + LTRIM (keeps max 500 samples)

**`intent-filter.service.spec.ts`**
- Passes through portfolio-related queries
- Blocks off-topic queries (coding help, general chat)

### Implementation pattern (use this for all unit tests)

```ts
// answer-question.use-case.spec.ts
import { mock, type MockProxy } from 'jest-mock-extended';
import { AnswerQuestionUseCase } from './answer-question.use-case';
import type { ILLMProvider } from '../../domain/ports/llm-provider.port';
import type { IKBRepository } from '../../domain/ports/kb-repository.port';

describe('AnswerQuestionUseCase', () => {
  let useCase: AnswerQuestionUseCase;
  let llm: MockProxy<ILLMProvider>;
  let kb: MockProxy<IKBRepository>;
  // ... other ports

  beforeEach(() => {
    llm = mock<ILLMProvider>();
    kb  = mock<IKBRepository>();
    useCase = new AnswerQuestionUseCase(llm, kb, /* other mocks */);
  });

  it('returns grounded answer with source chips', async () => {
    kb.findSimilar.mockResolvedValue([
      { id: 'doc-1', content: 'Hammad built a CRM system', title: 'CRM Case Study' },
    ]);
    llm.complete.mockResolvedValue({
      answer: 'He built a CRM system.',
      sources: ['doc-1'],
      toolCalls: [],
    });

    const result = await useCase.execute('What did Hammad build?', []);

    expect(result.answer).toBe('He built a CRM system.');
    expect(result.sources).toHaveLength(1);
    expect(kb.findSimilar).toHaveBeenCalledWith('What did Hammad build?', expect.any(Number));
  });

  it('passes conversation history to LLM', async () => {
    kb.findSimilar.mockResolvedValue([]);
    llm.complete.mockResolvedValue({ answer: 'Yes.', sources: [], toolCalls: [] });
    const history = [{ role: 'user' as const, content: 'previous question' }];

    await useCase.execute('follow-up?', history);

    expect(llm.complete).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ content: 'previous question' })]),
    );
  });
});
```

### Done criterion
- `pnpm --filter api test:cov` → all spec files pass
- Coverage for `chat/application/` ≥ 95%
- Coverage for `observability/application/` ≥ 90%

---

## Phase 3 — Backend Integration Tests

**Goal:** Every HTTP endpoint tested with real Postgres + Redis via Testcontainers. Catches DTO validation, auth guards, real DB constraints. Target: **~85% total backend coverage**.

### Files to create

```
services/api/src/
  modules/
    chat/
      presentation/
        controllers/
          chat.controller.spec.ts
    analytics/
      presentation/
        analytics.controller.spec.ts
    observability/
      presentation/
        observability.controller.spec.ts
    auth/
      presentation/
        controllers/
          auth.controller.spec.ts
          passkey.controller.spec.ts
    contact/
      presentation/
        contact.controller.spec.ts
    content/
      presentation/
        controllers/
          skills.controller.spec.ts
  test/
    app-helper.ts    ← shared NestJS app bootstrap
```

### `src/test/app-helper.ts`

```ts
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';

let app: INestApplication;

export async function buildApp(): Promise<INestApplication> {
  if (app) return app;
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.init();
  return app;
}

export async function closeApp() {
  await app?.close();
}
```

### Key test cases per controller

**`chat.controller.spec.ts`**
- `POST /chat` with valid query → 200 + `{ answer, sources, toolCalls }`
- `POST /chat` with empty string query → 400 validation error
- `POST /chat` with query > max length → 400
- `POST /chat` called 6 times from same IP → rate limited response (graceful, not 429)
- Sets `chat_session` httpOnly cookie on first call
- Reuses session from cookie on subsequent calls

**`analytics.controller.spec.ts`**
- `POST /analytics/collect` with valid `page_view` event → 201
- `POST /analytics/collect` with unknown event type → 400
- `POST /analytics/collect` with `path` > 2048 chars → 400
- `POST /analytics/collect` persists event to DB (query `analyticsEvent.findFirst`)

**`observability.controller.spec.ts`**
- `GET /system/metrics` → 200 + correct DTO shape
- `api.uptimeSeconds` is a positive number
- `redis.hitRatePct` is 0–100
- `rag.docCount` matches actual count in test DB
- Responds in < 500ms (metrics collection is fast)

**`auth.controller.spec.ts`**
- `POST /auth/login` with correct credentials → 200 + `{ access_token }`
- `POST /auth/login` with wrong password → 401
- `GET /auth/profile` with valid Bearer token → 200
- `GET /auth/profile` without token → 401
- `GET /auth/profile` with expired token → 401

**`skills.controller.spec.ts`** (content, tests ISR tag revalidation path)
- `GET /content/skills` → 200 + array
- `POST /content/skills` without auth → 401
- `POST /content/skills` with auth + valid body → 201
- `DELETE /content/skills/:id` removes record

### Implementation pattern

```ts
// chat.controller.spec.ts
import * as request from 'supertest';
import { startContainers, stopContainers } from '../../../test/containers';
import { buildApp, closeApp } from '../../../test/app-helper';
import type { INestApplication } from '@nestjs/common';

describe('ChatController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await startContainers(); // real PG + Redis
    app = await buildApp();
  }, 90_000);

  afterAll(async () => {
    await closeApp();
    await stopContainers();
  });

  it('POST /chat returns answer shape', async () => {
    const { body, status } = await request(app.getHttpServer())
      .post('/chat')
      .send({ query: 'What stack does Hammad use?' });

    expect(status).toBe(200);
    expect(body).toMatchObject({
      answer: expect.any(String),
      sources: expect.any(Array),
      toolCalls: expect.any(Array),
    });
  });

  it('POST /chat rejects empty query', async () => {
    const { status } = await request(app.getHttpServer())
      .post('/chat')
      .send({ query: '' });
    expect(status).toBe(400);
  });
});
```

### Done criterion
- `pnpm --filter api test:cov` → all spec files pass, 0 failures
- Global coverage ≥ 90%
- Auth tests confirm 401 path works correctly

---

## Phase 4 — Frontend Unit + Component Tests

**Goal:** All utility functions and key React components tested. Target: **≥ 90% frontend coverage**.

### Files to create

```
apps/web/src/
  lib/
    admin-api.test.ts
    analytics.test.ts
  app/
    system/
      page.test.tsx
  components/
    Nav.test.tsx
    SpeedDial.test.tsx
    (admin)/admin/login/
      page.test.tsx
```

### Key test cases per file

**`admin-api.test.ts`**
- `setTokenCache` + `apiFetch` sends `Authorization: Bearer <token>`
- `apiFetch` without token sends request without Authorization header
- `apiFetch` on 401 response clears token cache and redirects to `/admin/login`
- `apiFetch` on 500 throws with error message from response body
- `clearTokenCache` clears the in-memory token
- `adminLogin` calls `/api/admin-login` with correct body

**`system/page.test.tsx`**
- Shows loading skeleton initially
- Shows metrics grid after fetch resolves
- `p50Ms`, `hitRatePct`, `docCount` render correct values
- Shows "METRICS UNAVAILABLE" on fetch error
- Visitor count renders correct number of lime dots
- `formatUptime` renders "1d 2h 3m" for 93780 seconds
- Polling: `fetch` called again after 5 seconds (use `vi.useFakeTimers()`)
- Progress bar width matches metric percentage

**`Nav.test.tsx`**
- Renders all 7 nav links
- System link has a pulse dot `●`
- Active section gets lime underline (layout animation)
- Mobile hamburger opens/closes dropdown
- `trackConversion` called on nav link click

**`SpeedDial.test.tsx`**
- Closed by default
- Opens on button click
- Chat input accepts text
- Submits message on Enter key
- Loading state during API call

**`login/page.test.tsx`**
- Renders email + password inputs
- Shows error message on failed login
- Disables submit button during loading
- Passkey button visible when `browserSupportsWebAuthn()` returns true
- Passkey button hidden when browser doesn't support WebAuthn
- Calls `setTokenCache` on successful login

### Implementation pattern

```tsx
// app/system/page.test.tsx
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SystemPage from './page';

const mockMetrics = {
  api: { p50Ms: 23, p99Ms: 87, uptimeSeconds: 93780, sampleSize: 500 },
  db: { activeConnections: 3, txnPerMinute: 42 },
  redis: { hitRatePct: 94, memoryUsed: '41.2M' },
  rag: { docCount: 47, avgEmbedMs: 180 },
  visitorsOnline: 3,
  timestamp: Date.now(),
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockMetrics,
  }));
});

it('shows skeleton then populates metrics', async () => {
  render(<SystemPage />);
  expect(screen.getByText(/connecting/i)).toBeInTheDocument();

  await waitFor(() => expect(screen.getByText('23')).toBeInTheDocument());
  expect(screen.getByText('94')).toBeInTheDocument(); // redis hit rate
  expect(screen.getByText('47')).toBeInTheDocument(); // kb docs
  expect(screen.getByText('1d 2h 3m')).toBeInTheDocument(); // formatted uptime
});

it('shows error state on network failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
  render(<SystemPage />);
  await waitFor(() =>
    expect(screen.getByText(/metrics unavailable/i)).toBeInTheDocument()
  );
});

it('polls again after 5 seconds', async () => {
  vi.useFakeTimers();
  render(<SystemPage />);
  await act(async () => { vi.advanceTimersByTime(5_000); });
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});
```

### Done criterion
- `pnpm --filter web test:cov` → all tests pass
- Coverage ≥ 90% for `src/lib/`, `src/app/system/`, `src/components/Nav.tsx`

---

## Phase 5 — E2E Tests (Playwright)

**Goal:** 6 critical user journeys verified against the real running stack. These are slow but catch what unit tests can't — routing, cookies, WebSocket connections, ISR revalidation.

### `playwright.config.ts` (root)

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,   // retry flaky tests in CI only
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',          // saves trace on failure for debugging
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',   use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'docker compose up -d --wait && pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### Files to create

```
e2e/
  home.spec.ts
  chat.spec.ts
  system.spec.ts
  contact.spec.ts
  admin.spec.ts
  helpers/
    auth.ts      ← reusable login helper
```

### `e2e/helpers/auth.ts`

```ts
import type { Page } from '@playwright/test';

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('input[type="password"]', process.env.TEST_ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/dashboard');
}
```

### Key test cases per file

**`home.spec.ts`**
- Page loads with `< 3s` LCP
- Hero headline is visible
- Nav links scroll to correct sections
- System link in nav has pulse dot
- "Download Resume" link exists

**`chat.spec.ts`**
- SpeedDial button is visible
- Clicking opens chat panel
- Typing + Enter sends message
- Response appears within 10s
- Closing panel hides it
- Session cookie is set after first message

**`system.spec.ts`**
- `/system` loads without error
- "LIVE" indicator is visible
- Metric cards appear (API, Database, Redis, RAG)
- Values are numbers (not "NaN" or "undefined")
- Page auto-refreshes (metrics change over 10s window)

**`contact.spec.ts`**
- Form renders with name, email, message fields
- Submitting with empty fields shows validation
- Submitting valid form shows success state

**`admin.spec.ts`**
- `/admin` redirects to `/admin/login` when unauthenticated
- Wrong credentials shows error message
- Correct credentials → dashboard
- Dashboard shows nav items (Skills, Experience, Projects)
- Creating a skill → appears in skills list
- Deleting a skill → removed from list

### Done criterion
- `pnpm test:e2e` → all 6 files pass on Chromium
- No test relies on network timing (use `waitFor`, not `sleep`)
- Traces saved on any failure

---

## Phase 6 — CI/CD Integration

**Goal:** `main` branch is physically unbreakable. PRs must pass all checks. Deploy only runs after merge. Coverage enforced by Codecov.

### Files to create / modify

```
.github/
  workflows/
    pr.yml          ← new — the merge gate
    deploy.yml      ← update — add dependency on tests
  CODEOWNERS        ← optional: require your own review
```

### `.github/workflows/pr.yml`

Full file as detailed in the earlier planning section. Key structure:
```
lint-typecheck  (2 min)
     │
     ├── api-tests      (5 min, Testcontainers)
     └── web-tests      (2 min, Vitest)
              │
              └── build-check   (3 min)
                       │
                       └── e2e   (8 min, Playwright + docker compose)
```

Each job:
- Uploads coverage to Codecov
- Fails if coverage drops below threshold
- Saves Playwright traces as artifacts on failure

### Update `deploy.yml`

Add explicit guard — deploy only runs on `main` push and only after the images build cleanly:
```yaml
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

### Branch protection rules (GitHub UI)

Settings → Branches → Protection rule for `main`:
```
Required status checks:
  ✅ Lint + Type check
  ✅ API Tests
  ✅ Web Tests
  ✅ Build
  ✅ E2E (Playwright)

✅ Require branches to be up to date
✅ Require PR before merging
✅ Dismiss stale reviews on new commits
❌ Allow bypassing (OFF — no exceptions)
```

### Codecov setup

1. Sign up at codecov.io with your GitHub account
2. Add `CODECOV_TOKEN` to GitHub repo secrets
3. Coverage reports auto-post as PR comments showing diff

### Done criterion
- Open a test PR with a failing test → PR is blocked from merging
- Fix the test → all checks green → PR mergeable
- Merge to `main` → deploy workflow triggers automatically
- Force-push to `main` is rejected by branch protection

---

## Coverage Target Summary

| Phase | Tests added | Cumulative backend | Cumulative frontend |
|---|---|---|---|
| 1 — Setup | 0 | 0% | 0% |
| 2 — Unit | ~80 tests | ~55% | — |
| 3 — Integration | ~40 tests | ~90% | — |
| 4 — Components | ~50 tests | — | ~90% |
| 5 — E2E | ~30 scenarios | gap-fill | gap-fill |
| 6 — CI/CD | configuration | enforced | enforced |

---

## Quick Reference — Commands

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:cov

# Watch mode during development
pnpm --filter api test:watch
pnpm --filter web test:watch

# Run E2E locally (requires running stack)
pnpm test:e2e

# Run E2E with UI (debug mode)
pnpm --filter web exec playwright test --ui

# Check coverage report in browser
open services/api/coverage/index.html
open apps/web/coverage/index.html
```
