"use client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/admin-api";
import { PageHeader } from "@/components/admin/PageHeader";
import { SaveButton } from "@/components/admin/SaveButton";
import {
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Credential {
  id: string;
  credentialId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string;
  transports: string[];
}

function transportLabel(transports: string[]): string {
  if (transports.includes("internal")) return "Built-in (Touch ID / Face ID / Windows Hello)";
  if (transports.includes("usb")) return "USB Security Key";
  if (transports.includes("ble")) return "Bluetooth Key";
  if (transports.includes("nfc")) return "NFC Key";
  return transports.join(", ") || "Unknown";
}

export default function SecurityPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading]         = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deviceName, setDeviceName]   = useState("");
  const [message, setMessage]         = useState<{ ok: boolean; text: string } | null>(null);
  const supportsPasskey = typeof window !== "undefined" && browserSupportsWebAuthn();

  // Password change state
  const [pwCurrent, setPwCurrent]   = useState("");
  const [pwNew, setPwNew]           = useState("");
  const [pwConfirm, setPwConfirm]   = useState("");
  const [pwSaving, setPwSaving]     = useState(false);

  const loadCredentials = useCallback(async () => {
    try {
      const data = await apiFetch<Credential[]>("/auth/passkey/credentials");
      setCredentials(data);
    } catch {
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCredentials(); }, [loadCredentials]);

  async function handleRegister() {
    if (!supportsPasskey) {
      setMessage({ ok: false, text: "Your browser doesn't support passkeys." });
      return;
    }
    setRegistering(true);
    setMessage(null);
    try {
      // 1. Get registration options (requires existing JWT — you're already logged in)
      const optRes = await fetch(`${API_URL}/auth/passkey/register/begin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass current JWT from cookie via the apiFetch helper
          ...await getAuthHeader(),
        },
      });
      if (!optRes.ok) throw new Error("Failed to get registration options");
      const options = await optRes.json();

      // 2. Trigger browser authenticator
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Verify + store
      const verifyRes = await fetch(`${API_URL}/auth/passkey/register/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...await getAuthHeader(),
        },
        body: JSON.stringify({
          response: regResponse,
          deviceName: deviceName || getBrowserDeviceName(),
        }),
      });
      if (!verifyRes.ok) throw new Error("Failed to verify passkey registration");

      setMessage({ ok: true, text: "Passkey registered! You can now sign in with Touch ID / Face ID." });
      setDeviceName("");
      void loadCredentials();
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setMessage({ ok: false, text: "Registration cancelled." });
      } else {
        setMessage({ ok: false, text: err instanceof Error ? err.message : "Registration failed" });
      }
    } finally {
      setRegistering(false);
    }
  }

  async function handleChangePassword() {
    if (!pwCurrent || !pwNew || !pwConfirm) { toast.error("Fill in all three fields"); return; }
    if (pwNew !== pwConfirm) { toast.error("New passwords don't match"); return; }
    if (pwNew.length < 12) { toast.error("New password must be at least 12 characters"); return; }
    setPwSaving(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      toast.success("Password changed — use it next time you log in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove passkey "${name}"? You won't be able to use it to sign in.`)) return;
    try {
      await apiFetch(`/auth/passkey/credentials/${id}`, { method: "DELETE" });
      setMessage({ ok: true, text: `Passkey "${name}" removed.` });
      void loadCredentials();
    } catch {
      setMessage({ ok: false, text: "Failed to remove passkey." });
    }
  }

  return (
    <div>
      <PageHeader index="07 / SECURITY" title="Security" />

      <div className="space-y-8 max-w-2xl">
        {/* Passkey section */}
        <div className="bg-ink-800 border border-ink-600 rounded-card p-6 space-y-5">
          <div>
            <h2 className="font-mono text-mono-label text-text-hi uppercase tracking-widest mb-1">
              Passkeys
            </h2>
            <p className="text-text-mid text-sm">
              Sign in with Touch ID, Face ID, or Windows Hello — no password needed.
              Phishing-resistant by design (credential is cryptographically bound to this origin).
            </p>
          </div>

          {!supportsPasskey && (
            <div className="bg-warn/10 border border-warn/30 rounded-btn px-4 py-3 font-mono text-mono-label text-warn">
              Your browser doesn&apos;t support WebAuthn passkeys. Use Chrome, Safari, Firefox 119+, or Edge.
            </div>
          )}

          {/* Registered passkeys list */}
          {loading ? (
            <p className="font-mono text-mono-label text-text-lo">Loading…</p>
          ) : credentials.length === 0 ? (
            <div className="border border-dashed border-ink-600 rounded-btn p-4 text-center">
              <p className="font-mono text-mono-label text-text-lo">No passkeys registered yet.</p>
              <p className="font-mono text-xs text-text-lo mt-1">Register one below to enable passwordless login.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between bg-ink-900 border border-ink-600 rounded-btn px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-mono-label text-text-hi truncate">{cred.deviceName}</p>
                    <p className="font-mono text-xs text-text-lo mt-0.5">{transportLabel(cred.transports)}</p>
                    <p className="font-mono text-xs text-text-lo mt-0.5">
                      Last used: {new Date(cred.lastUsedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(cred.id, cred.deviceName)}
                    className="font-mono text-mono-label text-text-lo hover:text-danger transition-colors flex-shrink-0 ml-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Register new passkey */}
          {supportsPasskey && (
            <div className="border-t border-line pt-5 space-y-3">
              <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest">Add New Passkey</p>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder={`e.g. ${getBrowserDeviceName()}`}
                className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi font-mono text-sm placeholder:text-text-lo focus:outline-none focus:border-signal transition-colors"
              />
              <button
                onClick={handleRegister}
                disabled={registering}
                className="flex items-center gap-2.5 bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2.5 hover:bg-signal-dim active:scale-[0.98] disabled:opacity-40 transition-all"
              >
                {registering ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-signal-ink/30 border-t-signal-ink animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
                    <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
                    <path d="M2 12a10 10 0 0 1 18-6"/>
                    <path d="M8 11.12C8 8.86 9.8 7 12 7s4 1.86 4 4.12"/>
                  </svg>
                )}
                {registering ? "Follow browser prompt…" : "Register Passkey"}
              </button>
            </div>
          )}

          {message && (
            <div className={`flex items-center gap-2 rounded-btn px-3 py-2 ${
              message.ok
                ? "bg-ok/10 border border-ok/30 text-ok"
                : "bg-danger/10 border border-danger/30 text-danger"
            }`}>
              {message.ok
                ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,7 5.5,10.5 12,3.5"/></svg>
                : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
              }
              <p className="font-mono text-mono-label">{message.text}</p>
            </div>
          )}
        </div>

        {/* Password change */}
        <div className="bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
          <div>
            <h2 className="font-mono text-mono-label text-text-hi uppercase tracking-widest mb-1">Change Password</h2>
            <p className="text-text-mid text-sm">Minimum 12 characters. Your passkey remains valid after a password change.</p>
          </div>
          <div className="space-y-3 max-w-sm">
            {[
              { label: "Current password", value: pwCurrent, set: setPwCurrent },
              { label: "New password", value: pwNew, set: setPwNew },
              { label: "Confirm new password", value: pwConfirm, set: setPwConfirm },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">{label}</label>
                <input
                  type="password"
                  value={value}
                  onChange={e => set(e.target.value)}
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi font-mono text-sm focus:outline-none focus:border-signal transition-colors"
                />
              </div>
            ))}
            <SaveButton loading={pwSaving} onClick={() => void handleChangePassword()} type="button">
              Change Password
            </SaveButton>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-ink-900 border border-ink-600 rounded-card p-5">
          <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-3">How passkeys work</p>
          <ul className="space-y-2 text-sm text-text-mid font-mono">
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> Your device generates a unique key pair. The private key never leaves your device.</li>
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> The public key is stored here. Login = sign a server challenge with your private key.</li>
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> Phishing-resistant: credentials are bound to this exact domain — they won&apos;t work on a fake site.</li>
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> Keep your password as a backup until you&apos;ve confirmed the passkey works.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Helpers
function getBrowserDeviceName(): string {
  if (typeof window === "undefined") return "This device";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Mac/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const res = await fetch("/api/admin-auth", { method: "GET" });
    const { token } = await res.json() as { token: string | null };
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
