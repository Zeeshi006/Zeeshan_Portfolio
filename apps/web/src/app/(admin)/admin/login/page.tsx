"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, setTokenCache } from "@/lib/admin-api";
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // ── Password login ────────────────────────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { access_token } = await adminLogin(email, password);
      setTokenCache(access_token);
      await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", token: access_token }),
      });
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Passkey login ─────────────────────────────────────────────────────────
  async function handlePasskeyLogin() {
    if (!browserSupportsWebAuthn()) {
      setError("Your browser doesn't support passkeys. Use password instead.");
      return;
    }
    setPasskeyLoading(true);
    setError("");
    try {
      // 1. Get challenge from server
      const optRes = await fetch(`${API_URL}/auth/passkey/login/begin`, { method: "POST" });
      if (!optRes.ok) {
        const { message } = await optRes.json() as { message?: string };
        throw new Error(message ?? "No passkeys registered. Log in with password first.");
      }
      const options = await optRes.json();

      // 2. Trigger browser authenticator (Touch ID / Face ID / Windows Hello)
      const authResponse = await startAuthentication({ optionsJSON: options });

      // 3. Verify with server → get JWT
      const verifyRes = await fetch(`${API_URL}/auth/passkey/login/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResponse }),
      });
      if (!verifyRes.ok) throw new Error("Passkey verification failed");
      const { access_token } = await verifyRes.json() as { access_token: string };

      // 4. Seed in-memory cache, set httpOnly cookie, then redirect
      setTokenCache(access_token);
      await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", token: access_token }),
      });
      router.push("/admin/dashboard");
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Passkey cancelled or timed out.");
      } else {
        setError(err instanceof Error ? err.message : "Passkey login failed");
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  const [supportsPasskey, setSupportsPasskey] = useState(false);
  useEffect(() => { setSupportsPasskey(browserSupportsWebAuthn()); }, []);

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">

        {/* Card */}
        <div className="bg-ink-800 border border-ink-600 rounded-xl p-7 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">

          {/* Mark */}
          <div className="w-8 h-8 rounded-md bg-signal flex items-center justify-center mb-6">
            <span className="font-mono text-xs font-bold text-signal-ink leading-none">HA</span>
          </div>

          <h1 className="font-display text-[1.5rem] text-text-hi mb-0.5" style={{ letterSpacing: "-0.01em" }}>Welcome back</h1>
          <p className="font-mono text-[11px] text-text-lo mb-6">Sign in to manage your portfolio</p>

          {/* Passkey */}
          {supportsPasskey && (
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="w-full flex items-center justify-center gap-2 bg-ink-700 border border-ink-600 text-text-hi font-mono text-[11px] uppercase tracking-widest rounded-lg py-2.5 hover:border-signal hover:text-signal disabled:opacity-40 transition-colors mb-3"
            >
              {passkeyLoading ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-text-lo border-t-signal animate-spin" />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
                  <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
                  <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
                  <path d="M2 12a10 10 0 0 1 18-6"/>
                  <path d="M2 17.5a14.5 14.5 0 0 0 4.96 7.23"/>
                  <path d="M8 11.12C8 8.86 9.8 7 12 7s4 1.86 4 4.12"/>
                  <path d="M8 16s.2 1.46.55 2.18"/>
                  <path d="M2 12a10 10 0 0 0 3 7"/>
                </svg>
              )}
              {passkeyLoading ? "Waiting…" : "Sign in with Passkey"}
            </button>
          )}

          {supportsPasskey && (
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-line" />
              <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-line" />
            </div>
          )}

          {/* Password form */}
          <form onSubmit={handlePasswordSubmit} className="space-y-3" autoComplete="off">
            <div>
              <label className="block font-mono text-[10px] text-text-lo uppercase tracking-widest mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="you@example.com"
                className="w-full bg-ink-900 border border-ink-600 rounded-lg px-3 py-2.5 text-text-hi font-mono text-sm placeholder:text-text-lo focus:outline-none focus:border-signal transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-text-lo uppercase tracking-widest mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-ink-900 border border-ink-600 rounded-lg px-3 py-2.5 pr-10 text-text-hi font-mono text-sm placeholder:text-text-lo focus:outline-none focus:border-signal transition-colors"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-lo hover:text-text-hi transition-colors">
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
                <span className="text-danger text-xs">●</span>
                <p className="font-mono text-[11px] text-danger">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-signal text-signal-ink font-mono text-[11px] uppercase tracking-widest rounded-lg py-2.5 hover:bg-signal-dim active:scale-[0.98] transition-all disabled:opacity-40 mt-1">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-signal-ink/30 border-t-signal-ink animate-spin" />
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center font-mono text-[10px] text-text-lo uppercase tracking-widest mt-4">
          Secured with WebAuthn
        </p>
      </div>
    </div>
  );
}
