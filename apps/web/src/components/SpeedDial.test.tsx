import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('framer-motion', () => {
  const React = require('react');
  const forward = (tag: string) =>
    React.forwardRef(({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<unknown>) => {
      const domProps = Object.fromEntries(
        Object.entries(rest).filter(([k]) =>
          !['initial', 'animate', 'exit', 'variants', 'transition', 'whileHover', 'whileTap', 'layoutId', 'layout', 'drag', 'dragConstraints', 'onDrag'].includes(k)
        )
      );
      return React.createElement(tag, { ...domProps, ref }, children);
    });
  return {
    motion: new Proxy({}, { get: (_t, prop) => forward(String(prop)) }),
    AnimatePresence: ({ children }: React.PropsWithChildren) => children,
    useAnimation: () => ({ start: vi.fn() }),
    useMotionValue: (v: unknown) => ({ get: () => v, set: vi.fn() }),
  };
});

vi.mock('@/lib/analytics', () => ({
  trackConversion: vi.fn(),
  getSessionId: vi.fn().mockReturnValue('test-session-id'),
}));

import SpeedDial from './SpeedDial';

// jsdom does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('SpeedDial', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        answer: 'Hammad uses NestJS.',
        sources: [],
        toolCalls: [],
      }),
    } as unknown as Response);
  });

  it('renders without crashing', () => {
    render(<SpeedDial />);
  });

  it('renders the Chat split-pill button', () => {
    render(<SpeedDial />);
    expect(screen.getByRole('button', { name: /open ai chat/i })).toBeInTheDocument();
  });

  it('renders the AI Call split-pill button', () => {
    render(<SpeedDial />);
    expect(screen.getByRole('button', { name: /open ai voice call/i })).toBeInTheDocument();
  });

  it('no Close button visible before opening a panel', () => {
    render(<SpeedDial />);
    expect(screen.queryByRole('button', { name: /^close$/i })).toBeNull();
  });

  it('opens chat panel when Chat button is clicked', async () => {
    render(<SpeedDial />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat/i }));

    await waitFor(() => {
      // Chat panel shows a text input for user messages
      const input = document.querySelector('input[type="text"], textarea');
      expect(input).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('shows Close button after opening a panel', async () => {
    render(<SpeedDial />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    });
  });

  it('closes panel when Close button is clicked', async () => {
    render(<SpeedDial />);
    fireEvent.click(screen.getByRole('button', { name: /open ai chat/i }));

    await waitFor(() => screen.getByRole('button', { name: /^close$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^close$/i })).toBeNull();
    });
  });

  it('shows AI voice call button', () => {
    render(<SpeedDial />);
    expect(screen.getByRole('button', { name: /open ai voice call/i })).toBeInTheDocument();
  });
});
