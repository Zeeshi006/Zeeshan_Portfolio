"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/admin-api";
import { PageHeader } from "@/components/admin/PageHeader";

export default function GitHubPage() {
  const [syncing, setSyncing]   = useState(false);
  const [result, setResult]     = useState<{ ok: boolean; text: string } | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      await apiFetch("/github/cache", { method: "DELETE" });
      const now = new Date().toLocaleTimeString();
      setLastSynced(now);
      setResult({ ok: true, text: "Cache cleared. Reload the public site to see fresh data." });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <PageHeader index="06 / GITHUB" title="GitHub Sync" />

      <div className="space-y-6 max-w-xl">
        {/* Status card */}
        <div className="bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
            <span className="font-mono text-mono-label text-text-hi uppercase tracking-widest">
              Live Data Source
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {[
              ["Data source",   "GitHub GraphQL API v4"],
              ["Date window",   "Rolling 365 days — always ends today"],
              ["Cache TTL",     "15 minutes (auto-refresh)"],
              ["On-demand sync","Click Sync Now below"],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4">
                <span className="font-mono text-mono-label text-text-lo w-36 flex-shrink-0">{label}</span>
                <span className="font-mono text-mono-label text-text-mid">{value}</span>
              </div>
            ))}
            {lastSynced && (
              <div className="flex gap-4">
                <span className="font-mono text-mono-label text-text-lo w-36 flex-shrink-0">Last synced</span>
                <span className="font-mono text-mono-label text-signal">{lastSynced}</span>
              </div>
            )}
          </div>
        </div>

        {/* Why it stays correct automatically */}
        <div className="bg-ink-900 border border-ink-600 rounded-card p-5">
          <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-3">
            How sync works
          </p>
          <ul className="space-y-2 text-sm text-text-mid font-mono">
            <li className="flex gap-2">
              <span className="text-signal flex-shrink-0">→</span>
              The GraphQL query uses <span className="text-text-hi mx-1">new Date()</span> as the end date — so it always captures today&apos;s commits without any code changes.
            </li>
            <li className="flex gap-2">
              <span className="text-signal flex-shrink-0">→</span>
              Cache expires automatically every 15 min — the heatmap self-updates.
            </li>
            <li className="flex gap-2">
              <span className="text-signal flex-shrink-0">→</span>
              Use &ldquo;Sync Now&rdquo; to force an immediate refresh after pushing commits.
            </li>
          </ul>
        </div>

        {/* Sync button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2.5 bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-6 py-3 hover:bg-signal-dim active:scale-[0.98] disabled:opacity-40 transition-all"
          >
            <svg
              width="14" height="14"
              viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className={syncing ? "animate-spin" : ""}
            >
              <path d="M21 2v6h-6"/>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            {syncing ? "Syncing…" : "Sync Now"}
          </button>

          {result && (
            <span className={`font-mono text-mono-label ${result.ok ? "text-ok" : "text-danger"}`}>
              {result.ok
                ? <svg className="inline mr-1" width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,7 5.5,10.5 12,3.5"/></svg>
                : <svg className="inline mr-1" width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
              }{result.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
