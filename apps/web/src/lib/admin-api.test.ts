import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Import module fresh via dynamic import so we can reset module state between tests
// (the module has module-level _memToken state)

describe('admin-api', () => {
  let module: typeof import('./admin-api');
  const mockFetch = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    global.fetch = mockFetch;
    module = await import('./admin-api');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Token cache ──────────────────────────────────────────────────────────────

  describe('setTokenCache / clearTokenCache', () => {
    it('setTokenCache causes apiFetch to send Authorization header', async () => {
      module.setTokenCache('my-test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ data: 'ok' }),
      } as Response);

      await module.apiFetch('/some/path');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer my-test-token');
    });

    it('clearTokenCache removes Authorization header from subsequent requests', async () => {
      module.setTokenCache('some-token');
      module.clearTokenCache();

      // After clearTokenCache, _memToken is null so apiFetch calls the cookie-restore
      // endpoint first — mock that before the actual API call mock.
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ token: null }),
      } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({}),
      } as Response);

      await module.apiFetch('/some/path');

      // calls[0] is the cookie-restore, calls[1] is the actual API call
      const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });

    it('sends no Authorization header when cache is empty', async () => {
      // _memToken is null so cookie-restore is called first
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ token: null }),
      } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({}),
      } as Response);

      await module.apiFetch('/path');

      // calls[0] is the cookie-restore, calls[1] is the actual API call
      const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  // ── apiFetch ─────────────────────────────────────────────────────────────────

  describe('apiFetch()', () => {
    it('calls fetch with correct URL and Content-Type header', async () => {
      module.setTokenCache('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ result: 42 }),
      } as Response);

      await module.apiFetch('/test/endpoint');

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/test/endpoint');
      expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('returns parsed JSON body on success', async () => {
      module.setTokenCache('test-token');
      const body = { name: 'Hammad', role: 'engineer' };
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => body,
      } as Response);

      const result = await module.apiFetch<typeof body>('/profile');
      expect(result).toEqual(body);
    });

    it('returns undefined for 204 No Content', async () => {
      module.setTokenCache('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 204,
        json: async () => { throw new Error('no body'); },
      } as unknown as Response);

      const result = await module.apiFetch('/resource');
      expect(result).toBeUndefined();
    });

    it('throws error with server message on non-ok response', async () => {
      module.setTokenCache('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 400, statusText: 'Bad Request',
        json: async () => ({ message: 'Validation failed' }),
      } as unknown as Response);

      await expect(module.apiFetch('/bad')).rejects.toThrow('Validation failed');
    });

    it('throws status+statusText when error body has no message', async () => {
      module.setTokenCache('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 500, statusText: 'Internal Server Error',
        json: async () => ({}),
      } as unknown as Response);

      await expect(module.apiFetch('/crash')).rejects.toThrow('500 Internal Server Error');
    });

    it('clears token cache and redirects on 401', async () => {
      module.setTokenCache('expired-token');
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        href: '',
      } as unknown as Location);
      let href = '';
      Object.defineProperty(window, 'location', {
        configurable: true,
        get: () => ({ set href(v: string) { href = v; } }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false, status: 401, statusText: 'Unauthorized',
        json: async () => ({}),
      } as unknown as Response);

      await module.apiFetch('/protected');

      expect(href).toBe('/admin/login');
      locationSpy.mockRestore();
    });

    it('merges caller-provided headers with defaults', async () => {
      module.setTokenCache('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({}),
      } as Response);

      await module.apiFetch('/endpoint', {
        headers: { 'X-Custom': 'value' },
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['X-Custom']).toBe('value');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  // ── adminLogin ───────────────────────────────────────────────────────────────

  describe('adminLogin()', () => {
    it('POST to /api/admin-login with email and password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ access_token: 'jwt-token' }),
      } as Response);

      await module.adminLogin('admin@test.com', 'Admin@1234');

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/admin-login');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body as string)).toEqual({
        email: 'admin@test.com',
        password: 'Admin@1234',
      });
    });

    it('returns access_token on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ access_token: 'jwt-abc' }),
      } as Response);

      const result = await module.adminLogin('admin@test.com', 'pass');
      expect(result.access_token).toBe('jwt-abc');
    });

    it('throws error message from server on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      } as unknown as Response);

      await expect(module.adminLogin('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('throws default message when server returns no message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 401,
        json: async () => ({}),
      } as unknown as Response);

      await expect(module.adminLogin('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });
  });
});
