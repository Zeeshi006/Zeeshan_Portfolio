import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SystemPage from './page';

const mockMetrics = {
  api: { p50Ms: 42, p99Ms: 180, uptimeSeconds: 86500, sampleSize: 120 },
  db: { activeConnections: 5, txnPerMinute: 23 },
  redis: { hitRatePct: 94, memoryUsed: '2.1M' },
  rag: { docCount: 47, avgEmbedMs: 210 },
  visitorsOnline: 3,
  timestamp: Date.now(),
};

function mockFetchSuccess(data = mockMetrics) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  } as unknown as Response);
}

function mockFetchError() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
}

describe('SystemPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', async () => {
    mockFetchSuccess();
    await act(async () => { render(<SystemPage />); });
  });

  it('shows "01 / SYSTEM" section index', async () => {
    mockFetchSuccess();
    await act(async () => { render(<SystemPage />); });
    expect(screen.getByText(/01 \/ SYSTEM/i)).toBeInTheDocument();
  });

  it('shows "Live Infrastructure" heading', async () => {
    mockFetchSuccess();
    await act(async () => { render(<SystemPage />); });
    expect(screen.getByRole('heading', { name: /live infrastructure/i })).toBeInTheDocument();
  });

  it('shows skeleton while loading (before fetch resolves)', () => {
    // Never-resolving fetch — page stays in loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => undefined));
    render(<SystemPage />);
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('shows CONNECTING status initially', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => undefined));
    render(<SystemPage />);
    expect(screen.getByText('CONNECTING…')).toBeInTheDocument();
  });

  it('shows metric values after fetch resolves', async () => {
    mockFetchSuccess();
    render(<SystemPage />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows DB active connections count', async () => {
    mockFetchSuccess();
    render(<SystemPage />);
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows Redis memory usage', async () => {
    mockFetchSuccess();
    render(<SystemPage />);
    await waitFor(() => expect(screen.getByText('2.1M')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows RAG doc count', async () => {
    mockFetchSuccess();
    render(<SystemPage />);
    await waitFor(() => expect(screen.getByText('47')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows visitors online count', async () => {
    mockFetchSuccess();
    render(<SystemPage />);
    await waitFor(() => expect(screen.getByText(/3 ONLINE NOW/i)).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows "DEGRADED" status on fetch error', async () => {
    mockFetchError();
    render(<SystemPage />);
    await waitFor(() => expect(screen.getByText('DEGRADED')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('fetches from the system/metrics endpoint', async () => {
    mockFetchSuccess();
    render(<SystemPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/system/metrics'),
      expect.any(Object),
    ), { timeout: 3000 });
  });

  it('calls fetch with cache: no-store', async () => {
    mockFetchSuccess();
    render(<SystemPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: 'no-store' }),
    ), { timeout: 3000 });
  });

  it('shows uptime in human format (Xd Yh Zm)', async () => {
    mockFetchSuccess({ ...mockMetrics, api: { ...mockMetrics.api, uptimeSeconds: 86500 } });
    render(<SystemPage />);
    await waitFor(() => expect(screen.getByText(/1d/)).toBeInTheDocument(), { timeout: 3000 });
  });
});
