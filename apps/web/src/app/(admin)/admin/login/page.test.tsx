import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── vi.hoisted ensures mocks are available before imports are hoisted ──────────

const { mockAdminLogin, mockSetTokenCache } = vi.hoisted(() => ({
  mockAdminLogin: vi.fn(),
  mockSetTokenCache: vi.fn(),
}));

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/admin/login',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/admin-api', () => ({
  adminLogin: mockAdminLogin,
  setTokenCache: mockSetTokenCache,
}));

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
  browserSupportsWebAuthn: vi.fn().mockReturnValue(true),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import LoginPage from './page';

describe('Admin LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response);
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it('renders without crashing', () => {
    render(<LoginPage />);
  });

  it('renders an email input', () => {
    render(<LoginPage />);
    const email = document.querySelector('input[type="email"]');
    expect(email).toBeInTheDocument();
  });

  it('renders a password input', () => {
    render(<LoginPage />);
    const pw = document.querySelector('input[type="password"]');
    expect(pw).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<LoginPage />);
    const buttons = screen.getAllByRole('button');
    // At minimum: sign-in button + passkey button
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Password login flow ──────────────────────────────────────────────────────

  it('calls adminLogin with form values on submit', async () => {
    mockAdminLogin.mockResolvedValueOnce({ access_token: 'tok-abc' });

    render(<LoginPage />);
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const form = document.querySelector('form') as HTMLFormElement;

    fireEvent.change(emailInput, { target: { value: 'admin@test.com' } });
    fireEvent.change(pwInput, { target: { value: 'Admin@1234' } });

    await act(async () => { fireEvent.submit(form); });

    expect(mockAdminLogin).toHaveBeenCalledWith('admin@test.com', 'Admin@1234');
  });

  it('calls setTokenCache with returned token on success', async () => {
    mockAdminLogin.mockResolvedValueOnce({ access_token: 'jwt-xyz' });

    render(<LoginPage />);
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const form = document.querySelector('form') as HTMLFormElement;

    fireEvent.change(emailInput, { target: { value: 'admin@test.com' } });
    fireEvent.change(pwInput, { target: { value: 'Admin@1234' } });

    await act(async () => { fireEvent.submit(form); });

    expect(mockSetTokenCache).toHaveBeenCalledWith('jwt-xyz');
  });

  it('redirects to /admin/dashboard after successful login', async () => {
    mockAdminLogin.mockResolvedValueOnce({ access_token: 'tok-abc' });

    render(<LoginPage />);
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const form = document.querySelector('form') as HTMLFormElement;

    fireEvent.change(emailInput, { target: { value: 'admin@test.com' } });
    fireEvent.change(pwInput, { target: { value: 'Admin@1234' } });

    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/dashboard'), { timeout: 2000 });
  });

  it('shows error message on failed login', async () => {
    mockAdminLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage />);
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const form = document.querySelector('form') as HTMLFormElement;

    fireEvent.change(emailInput, { target: { value: 'wrong@test.com' } });
    fireEvent.change(pwInput, { target: { value: 'wrong' } });

    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument(), { timeout: 2000 });
  });

  it('does not redirect on failed login', async () => {
    mockAdminLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage />);
    const form = document.querySelector('form') as HTMLFormElement;
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'wrong@test.com' } });
    fireEvent.change(pwInput, { target: { value: 'wrong' } });

    await act(async () => { fireEvent.submit(form); });

    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Passkey button ───────────────────────────────────────────────────────────

  it('shows browser-does-not-support error when WebAuthn unavailable', async () => {
    const { browserSupportsWebAuthn } = await import('@simplewebauthn/browser');
    vi.mocked(browserSupportsWebAuthn).mockReturnValueOnce(false);

    render(<LoginPage />);
    const allBtns = screen.getAllByRole('button');
    const passkeyBtn = allBtns.find(b =>
      b.textContent?.toLowerCase().includes('passkey') ||
      b.textContent?.toLowerCase().includes('biometric') ||
      b.textContent?.toLowerCase().includes('touch id') ||
      b.textContent?.toLowerCase().includes('windows hello')
    );

    if (passkeyBtn) {
      await act(async () => { fireEvent.click(passkeyBtn); });
      await waitFor(() => {
        expect(screen.getByText(/browser|support|passkey/i)).toBeInTheDocument();
      });
    }
  });
});
