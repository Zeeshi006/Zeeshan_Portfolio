"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/admin-api";

const SECTIONS = [
  { label: "Skills",            href: "/admin/dashboard/skills",            desc: "Skill categories, proficiency levels, spotlight cards" },
  { label: "Experience",        href: "/admin/dashboard/experience",        desc: "Work history timeline and highlights" },
  { label: "Projects",          href: "/admin/dashboard/projects",          desc: "Project cards, links, and inline case study write-ups" },
  { label: "Site Content",      href: "/admin/dashboard/content",           desc: "Hero headline, CTAs, availability status" },
  { label: "Knowledge Base",    href: "/admin/dashboard/knowledge-base",    desc: "RAG documents and chatbot test playground" },
  { label: "Blog",              href: "/admin/dashboard/blog",              desc: "Write and publish blog posts with Markdown preview" },
  { label: "Analytics",         href: "/admin/dashboard/analytics",         desc: "Visitors, scroll depth, funnels, chatbot usage" },
  { label: "Conversations",     href: "/admin/dashboard/conversations",     desc: "Chat message history and voice call transcripts" },
  { label: "Chatbot Settings",  href: "/admin/dashboard/chatbot-settings",  desc: "LLM spend, token limits, IP blocklist" },
  { label: "Voice Settings",    href: "/admin/dashboard/voice-settings",    desc: "ElevenLabs character quota and agent test" },
  { label: "GitHub",            href: "/admin/dashboard/github",            desc: "Flush the GitHub contribution heatmap cache" },
  { label: "Security",          href: "/admin/dashboard/security",          desc: "Passkeys, password change, login audit log" },
];

const FEATURE_KEYS = {
  chat:  "feature_chatbot_enabled",
  voice: "feature_voice_enabled",
} as const;

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

type FeatureKey = keyof typeof FEATURE_KEYS;

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      style={{
        position: "relative",
        display: "inline-block",
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: enabled ? "#C6FF3A" : "#1E2430",
        border: "none",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
        transition: "background-color 0.2s",
        outline: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 4,
          left: enabled ? 24 : 4,
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: enabled ? "#14210A" : "#5C6573",
          transition: "left 0.2s",
          display: "block",
        }}
      />
    </button>
  );
}

export default function DashboardPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [flags, setFlags] = useState({ chat: true, voice: true });
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<FeatureKey | null>(null);
  const [flagMsg, setFlagMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [chat, voice] = await Promise.all([
          fetch(`${API_URL}/content/site/${FEATURE_KEYS.chat}`).then((r) => r.ok ? r.json() as Promise<{ enabled: boolean } | null> : null),
          fetch(`${API_URL}/content/site/${FEATURE_KEYS.voice}`).then((r) => r.ok ? r.json() as Promise<{ enabled: boolean } | null> : null),
        ]);
        setFlags({
          chat:  chat  == null ? true : (chat as { enabled: boolean }).enabled !== false,
          voice: voice == null ? true : (voice as { enabled: boolean }).enabled !== false,
        });
      } catch { /* keep defaults */ }
      finally { setFlagsLoading(false); }
    })();
  }, []);

  async function toggleFeature(key: FeatureKey, value: boolean) {
    setSavingKey(key);
    setFlagMsg(null);
    try {
      await apiFetch(`/content/site/${FEATURE_KEYS[key]}`, {
        method: "PUT",
        body: JSON.stringify({ value: { enabled: value } }),
      });
      setFlags((prev) => ({ ...prev, [key]: value }));
      setFlagMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setFlagMsg({ ok: false, text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSavingKey(null);
      setTimeout(() => setFlagMsg(null), 3000);
    }
  }

  async function handleGitHubSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      await apiFetch("/github/cache", { method: "DELETE" });
      setSyncMsg({ ok: true, text: "Cache cleared — heatmap will refresh on next page load." });
    } catch (err) {
      setSyncMsg({ ok: false, text: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">00 / OVERVIEW</span>
          <h1 className="text-h2 sm:text-display-l font-display text-text-hi mt-1">Dashboard</h1>
        </div>

        {/* GitHub sync — clears Redis cache, next page load re-fetches live */}
        <div className="flex flex-col items-start sm:items-end gap-1">
          <button
            onClick={handleGitHubSync}
            disabled={syncing}
            className="flex items-center gap-2 border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-2 hover:border-signal hover:text-signal disabled:opacity-40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? "animate-spin" : ""}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            {syncing ? "Syncing…" : "Sync GitHub"}
          </button>
          {syncMsg && (
            <span className={`font-mono text-[10px] uppercase tracking-wider ${syncMsg.ok ? "text-ok" : "text-danger"}`}>
              {syncMsg.text}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block bg-ink-800 border border-ink-600 rounded-card p-6 hover:border-signal hover:-translate-y-1 transition-all"
          >
            <p className="font-mono text-mono-label text-signal uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-text-mid text-small">{s.desc}</p>
          </Link>
        ))}
      </div>

      {/* Feature Controls */}
      <div className="mt-8 bg-ink-800 border border-ink-600 rounded-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-mono text-mono-label text-signal uppercase tracking-widest mb-0.5">Feature Controls</p>
            <p className="text-text-lo text-small">Toggle public-facing AI features on or off instantly.</p>
          </div>
          {flagMsg && (
            <span className={`font-mono text-[10px] uppercase tracking-wider ${flagMsg.ok ? "text-ok" : "text-danger"}`}>
              {flagMsg.text}
            </span>
          )}
        </div>

        <div className={`space-y-4 ${flagsLoading ? "opacity-50 pointer-events-none" : ""}`}>
          {([
            { key: "chat"  as FeatureKey, label: "Chat AI",    desc: "The Ask My Portfolio chatbot widget in the bottom-right corner." },
            { key: "voice" as FeatureKey, label: "Voice Call", desc: "The AI voice call feature (ElevenLabs agent)." },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-6 py-3 border-b border-line last:border-0">
              <div>
                <p className={`font-mono text-sm font-medium ${flags[key] ? "text-text-hi" : "text-text-lo"}`}>{label}</p>
                <p className="font-mono text-xs text-text-lo mt-0.5">{desc}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`font-mono text-[10px] uppercase tracking-widest ${flags[key] ? "text-ok" : "text-text-lo"}`}>
                  {savingKey === key ? "Saving…" : flags[key] ? "On" : "Off"}
                </span>
                <Toggle
                  enabled={flags[key]}
                  onChange={(v) => void toggleFeature(key, v)}
                  disabled={savingKey !== null}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
