"use client";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { apiFetch } from "@/lib/admin-api";

interface VoiceUsage {
  characterCount: number;
  characterLimit: number;
  remainingPct: number;
  resetAt: string | null;
}

function UsageBar({ pct }: { pct: number }) {
  const color = pct <= 20 ? "bg-danger" : pct <= 40 ? "bg-warn" : "bg-signal";
  return (
    <div className="w-full h-2 bg-ink-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function VoiceSettingsPage() {
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [usage, setUsage] = useState<VoiceUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const data = await apiFetch<VoiceUsage>("/chat/kb/voice-usage");
      setUsage(data);
    } catch (err) {
      setUsageError(String(err));
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsage(); }, [fetchUsage]);

  async function testVoiceToken() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/voice-token", { method: "POST" });
      const data = await res.json() as { signedUrl?: string; error?: string };
      if (data.signedUrl) {
        setTestResult("OK ElevenLabs token obtained successfully. Voice agent is configured.");
      } else {
        setTestResult(`ERR ${data.error ?? "Unknown error"}`);
      }
    } catch (err) {
      setTestResult(`ERR ${String(err)}`);
    } finally {
      setTestLoading(false);
    }
  }

  const remaining = usage ? usage.characterLimit - usage.characterCount : 0;
  const resetDate = usage?.resetAt
    ? new Date(usage.resetAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div>
      <PageHeader index="10 / VOICE" title="Voice Settings" />

      <div className="space-y-8 max-w-2xl">

        {/* ── ElevenLabs Character Usage ─────────────────────────────────────── */}
        <section className="bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-mono-label text-text-hi uppercase tracking-widest">
              Character Usage
            </h2>
            <button
              onClick={() => void fetchUsage()}
              disabled={usageLoading}
              className="font-mono text-[10px] text-text-lo hover:text-text-hi transition-colors uppercase tracking-widest disabled:opacity-40"
            >
              {usageLoading ? "Loading…" : (
                <span className="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2v4h-4"/><path d="M1 7a6 6 0 0 1 10.3-4.2L13 6"/><path d="M1 12v-4h4"/><path d="M13 7a6 6 0 0 1-10.3 4.2L1 8"/></svg>
                  Refresh
                </span>
              )}
            </button>
          </div>

          {usageError ? (
            <p className="font-mono text-[11px] text-danger">{usageError}</p>
          ) : usageLoading ? (
            <div className="space-y-3">
              <div className="h-2 bg-ink-700 rounded-full animate-pulse" />
              <div className="h-4 w-48 bg-ink-700 rounded animate-pulse" />
            </div>
          ) : usage && usage.characterLimit > 0 ? (
            <div className="space-y-3">
              <UsageBar pct={usage.remainingPct} />

              <div className="flex items-baseline justify-between">
                <div>
                  <span className={`font-mono text-xl font-bold tabular-nums ${usage.remainingPct <= 20 ? "text-danger" : usage.remainingPct <= 40 ? "text-warn" : "text-signal"}`}>
                    {usage.remainingPct}%
                  </span>
                  <span className="font-mono text-[11px] text-text-lo ml-2">remaining</span>
                </div>
                {usage.remainingPct <= 20 && (
                  <span className="font-mono text-[9px] text-warn uppercase tracking-widest animate-pulse">
                    LOW — top up soon
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { label: "Used", value: usage.characterCount.toLocaleString() },
                  { label: "Limit", value: usage.characterLimit.toLocaleString() },
                  { label: "Remaining", value: remaining.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-ink-900 border border-ink-600 rounded-btn px-3 py-2.5">
                    <p className="font-mono text-[9px] text-text-lo uppercase tracking-widest mb-1">{label}</p>
                    <p className="font-mono text-[13px] text-text-hi tabular-nums font-bold">{value}</p>
                  </div>
                ))}
              </div>

              {resetDate && (
                <p className="font-mono text-[10px] text-text-lo">
                  Resets {resetDate}
                </p>
              )}

              <p className="text-[11px] text-text-lo">
                Alert email sent to <span className="text-text-mid">hammad.afzal.code@gmail.com</span> automatically when usage drops below 20%.
              </p>
            </div>
          ) : (
            <p className="font-mono text-[11px] text-text-lo">
              No usage data — check ELEVENLABS_API_KEY is set.
            </p>
          )}
        </section>

        {/* ── Agent Configuration ─────────────────────────────────────────────── */}
        <section className="bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
          <h2 className="font-mono text-mono-label text-text-hi uppercase tracking-widest">
            ElevenLabs Conversational AI
          </h2>
          <p className="text-text-mid text-sm leading-relaxed">
            The voice agent uses ElevenLabs Conversational AI. Configuration is via environment variables
            — set these in your deployment environment:
          </p>

          <div className="space-y-3">
            {[
              { key: "ELEVENLABS_AGENT_ID", desc: "Your Conversational AI agent ID from ElevenLabs dashboard" },
              { key: "ELEVENLABS_API_KEY", desc: "ElevenLabs API key (used server-side only, never exposed to client)" },
            ].map(({ key, desc }) => (
              <div key={key} className="bg-ink-900 border border-ink-600 rounded-btn px-4 py-3">
                <p className="font-mono text-mono-label text-signal mb-0.5">{key}</p>
                <p className="text-text-lo text-xs">{desc}</p>
              </div>
            ))}
          </div>

          {/* Test connection */}
          <div className="border-t border-line pt-4">
            <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-3">
              Test Connection
            </p>
            <button
              onClick={() => void testVoiceToken()}
              disabled={testLoading}
              className="flex items-center gap-2 bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2.5 hover:bg-signal-dim active:scale-[0.98] disabled:opacity-40 transition-all"
            >
              {testLoading ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-signal-ink/30 border-t-signal-ink animate-spin" />
              ) : null}
              {testLoading ? "Testing…" : "Test Token Endpoint"}
            </button>
            {testResult && (
              <p className={`mt-3 font-mono text-mono-label ${testResult.startsWith("OK") ? "text-ok" : "text-danger"}`}>
                {testResult}
              </p>
            )}
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────────────── */}
        <section className="bg-ink-900 border border-ink-600 rounded-card p-5">
          <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-3">How it works</p>
          <ul className="space-y-2 text-sm text-text-mid font-mono">
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> Visitor clicks &quot;Start Call&quot; in the SpeedDial.</li>
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> Browser calls <code className="text-text-hi">/api/voice-token</code> (Next.js server-side) to get a signed ElevenLabs WebSocket URL.</li>
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> <code className="text-text-hi">@elevenlabs/client</code> SDK opens a WebRTC session to ElevenLabs — no API key in the client bundle.</li>
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> Transcript is posted to <code className="text-text-hi">/chat/transcript</code> when the call ends, visible in Conversations.</li>
            <li className="flex gap-2"><span className="text-signal flex-shrink-0">→</span> Usage is checked hourly — email alert fires when characters drop below 20%.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
