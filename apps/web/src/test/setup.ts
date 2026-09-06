import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Default global fetch mock — override per-test as needed
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => '',
} as unknown as Response);

// Silence Next.js router warnings in tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Silence Next.js image warnings
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => {
    const React = require('react');
    return React.createElement('img', { src, alt });
  },
}));

// Suppress console noise in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});
