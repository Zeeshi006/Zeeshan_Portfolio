"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/admin-api";
import { PageHeader } from "@/components/admin/PageHeader";

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F:]+)$|^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

interface SpendStats {
  todayUsd: number;
  ceilingUsd: number;
  percentUsed: number;
  last30DaysUsd: number[];
}

interface BlocklistData {
  ips: string[];
}

interface TopQuery {
  query: string;
  count: number;
}

export default function ChatbotSettingsPage() {
  const [spend, setSpend] = useState<SpendStats | null>(null);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [newIp, setNewIp] = useState("");
  const [ipError, setIpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [s, b, q] = await Promise.all([
        apiFetch<SpendStats>("/chat/spend"),
        apiFetch<BlocklistData>("/chat/blocklist"),
        apiFetch<TopQuery[]>("/chat/top-queries?limit=10"),
      ]);
      setSpend(s);
      setBlocklist(b.ips);
      setTopQueries(q);
    } catch {
      setMsg({ ok: false, text: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function addIp() {
    const ip = newIp.trim();
    if (!ip) return;
    if (!IP_REGEX.test(ip)) {
      setIpError("Enter a valid IPv4, IPv6, or CIDR address");
      return;
    }
    setIpError(null);
    try {
      await apiFetch("/chat/blocklist", { method: "POST", body: JSON.stringify({ ip }) });
      setNewIp("");
      toast.success(`${ip} blocked`);
      setMsg(null);
      void load();
    } catch {
      toast.error("Failed to add IP");
    }
  }

  async function removeIp(ip: string) {
    if (!confirm(`Unblock ${ip}?`)) return;
    try {
      await apiFetch(`/chat/blocklist/${encodeURIComponent(ip)}`, { method: "DELETE" });
      toast.success(`${ip} unblocked`);
      setMsg(null);
      void load();
    } catch {
      toast.error("Failed to remove IP");
    }
  }

  return (
    <div>
      <PageHeader index="09 / CHATBOT" title="Chatbot Settings" />

      {msg && (
        <div className={`mb-6 rounded-card px-4 py-3 font-mono text-mono-label border ${
          msg.ok
            ? "bg-ok/10 border-ok/30 text-ok"
            : "bg-danger/10 border-danger/30 text-danger"
        }`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="font-mono text-mono-label text-text-lo">Loading…</p>
      ) : (
        <div className="space-y-8 max-w-3xl">

          {/* ── Spend Dashboard ──────────────────────────────────────────────── */}
          <section className="bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
            <h2 className="font-mono text-mono-label text-text-hi uppercase tracking-widest">
              Daily LLM Spend
            </h2>
            {spend && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Today</p>
                    <p className="font-mono text-2xl text-signal">${spend.todayUsd.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Ceiling</p>
                    <p className="font-mono text-2xl text-text-hi">${spend.ceilingUsd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Used</p>
                    <p className={`font-mono text-2xl ${spend.percentUsed > 80 ? "text-warn" : "text-text-hi"}`}>
                      {spend.percentUsed.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-ink-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, spend.percentUsed)}%`,
                      background: spend.percentUsed > 80 ? "var(--warn)" : "var(--signal)",
                    }}
                  />
                </div>

                {/* 7-day chart */}
                <div>
                  <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-2">
                    Last 7 Days
                  </p>
                  <div className="flex items-end gap-1 h-16">
                    {(spend.last30DaysUsd ?? []).slice(-7).map((val, i) => {
                      const max = Math.max(...(spend.last30DaysUsd ?? []).slice(-7), 0.001);
                      const pct = (val / max) * 100;
                      const isToday = i === 6;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            title={`$${val.toFixed(4)}`}
                            className="w-full rounded-sm transition-all"
                            style={{
                              height: `${Math.max(4, pct)}%`,
                              background: isToday ? "var(--signal)" : "var(--ink-600)",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ── IP Blocklist ─────────────────────────────────────────────────── */}
          <section className="bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
            <h2 className="font-mono text-mono-label text-text-hi uppercase tracking-widest">
              IP Blocklist
            </h2>
            <p className="text-text-mid text-sm">
              Blocked IPs are refused at the rate-limiter layer before any LLM call is made.
            </p>

            <div className="space-y-2">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => { setNewIp(e.target.value); setIpError(null); }}
                  placeholder="1.2.3.4 or 2001:db8::1 or 192.168.0.0/24"
                  onKeyDown={(e) => { if (e.key === "Enter") void addIp(); }}
                  className={`flex-1 bg-ink-900 border rounded-btn px-3 py-2 text-text-hi font-mono text-mono-label placeholder:text-text-lo focus:outline-none transition-colors ${ipError ? "border-danger focus:border-danger" : "border-ink-600 focus:border-signal"}`}
                />
                <button
                  onClick={() => void addIp()}
                  className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-2 hover:bg-signal-dim active:scale-[0.98] transition-all"
                >
                  Block
                </button>
              </div>
              {ipError && <p className="font-mono text-mono-label text-danger text-xs">{ipError}</p>}
            </div>

            {blocklist.length === 0 ? (
              <p className="font-mono text-mono-label text-text-lo">No IPs blocked.</p>
            ) : (
              <div className="space-y-1">
                {blocklist.map((ip) => (
                  <div key={ip} className="flex items-center justify-between bg-ink-900 border border-ink-600 rounded-btn px-3 py-2">
                    <span className="font-mono text-mono-label text-text-hi">{ip}</span>
                    <button
                      onClick={() => void removeIp(ip)}
                      className="font-mono text-mono-label text-text-lo hover:text-danger transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Top Queries ──────────────────────────────────────────────────── */}
          <section className="bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
            <h2 className="font-mono text-mono-label text-text-hi uppercase tracking-widest">
              Top Questions
            </h2>
            {topQueries.length === 0 ? (
              <p className="font-mono text-mono-label text-text-lo">No queries recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {topQueries.map((q, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 bg-ink-900 border border-ink-600 rounded-btn px-4 py-2.5">
                    <span className="text-text-mid text-sm flex-1 min-w-0 truncate">{q.query}</span>
                    <span className="font-mono text-mono-label text-signal flex-shrink-0">{q.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
