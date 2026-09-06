// Shared test data factories — deterministic, no random IDs unless needed.

export const fixtures = {
  skill: (overrides: Record<string, unknown> = {}) => ({
    name: 'NestJS',
    category: 'Backend',
    proficiencyLevel: 5,
    sortOrder: 0,
    ...overrides,
  }),

  project: (overrides: Record<string, unknown> = {}) => ({
    title: 'Test Project',
    slug: `test-project-${Date.now()}`,
    tagline: 'A test project',
    techStack: ['NestJS', 'PostgreSQL'],
    outcomeMetric: '99% uptime',
    status: 'shipped',
    featured: false,
    sortOrder: 0,
    ...overrides,
  }),

  kbDocument: (overrides: Record<string, unknown> = {}) => ({
    title: 'Test KB Document',
    content: 'Hammad has 3 years of NestJS experience building clean-architecture APIs.',
    published: true,
    metadata: {},
    ...overrides,
  }),

  analyticsEvent: (overrides: Record<string, unknown> = {}) => ({
    type: 'page_view',
    path: '/',
    sessionId: 'test-session-001',
    metadata: {},
    ...overrides,
  }),

  chatMessage: {
    query: 'What stack does Hammad use?',
    history: [] as { role: 'user' | 'assistant'; content: string }[],
  },

  adminCredentials: {
    email: 'admin@test.com',
    password: 'Admin@1234',
  },
};
