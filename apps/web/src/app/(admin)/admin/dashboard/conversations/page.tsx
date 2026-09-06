"use client";
import { useEffect, useState, useCallback } from "react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { apiFetch } from "@/lib/admin-api";
import { PageHeader } from "@/components/admin/PageHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConversationSummary {
  id: string;
  sessionId: string;
  ipHash: string;
  type: "text" | "voice";
  messageCount: number;
  firstMessage: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: { id: string; title: string }[];
  toolCalls: { name: string; args: Record<string, unknown> }[];
  fromCache: boolean;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  sessionId: string;
  ipHash: string;
  type: string;
  voiceConversationId: string | null;
  summary: string | null;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ConversationsList {
  data: ConversationSummary[];
  total: number;
  page: number;
  limit: number;
}

interface Stats {
  todayTotal: number;
  todayText: number;
  todayVoice: number;
  allTimeTotal: number;
}

interface SpendStats {
  todayUsd: number;
  ceilingUsd: number;
  percentUsed: number;
  last30DaysUsd: number[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function TypeBadge({ type }: { type: string }) {
  const isVoice = type === "voice";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${
      isVoice ? "bg-signal/10 text-signal border border-signal/30" : "bg-ink-700 text-text-mid border border-ink-600"
    }`}>
      {isVoice ? "🎙 Voice" : "💬 Chat"}
    </span>
  );
}

// ── Inline conversation thread ────────────────────────────────────────────────

function ConversationThread({ detail, loading }: { detail: ConversationDetail | null; loading: boolean }) {
  if (loading) return <p className="font-mono text-mono-label text-text-lo text-center py-6">Loading…</p>;
  if (!detail) return <p className="font-mono text-mono-label text-danger text-center py-6">Failed to load</p>;

  return (
    <div className="space-y-3">
      {/* AI-generated call summary — voice sessions only */}
      {detail.type === "voice" && (
        <div className={`rounded-lg px-4 py-3 border ${
          detail.summary
            ? "bg-signal/5 border-signal/20"
            : "bg-ink-900 border-ink-600"
        }`}>
          <p className="font-mono text-[9px] uppercase tracking-widest text-text-lo mb-1.5">
            {detail.summary ? "AI Call Summary" : "Call Summary"}
          </p>
          {detail.summary ? (
            <p className="text-sm text-text-hi leading-relaxed">{detail.summary}</p>
          ) : (
            <p className="text-xs text-text-lo italic">Summary not yet generated — fires after transcript is saved.</p>
          )}
        </div>
      )}
      {detail.messages.map((msg) => (
        <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
          <div className={`flex items-center gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-lo">
              {msg.role === "user" ? "Visitor" : "AI"}
            </span>
            <span className="font-mono text-[10px] text-text-lo opacity-50">{fmt(msg.createdAt)}</span>
            {msg.fromCache && <span className="font-mono text-[10px] text-signal opacity-70">cached</span>}
          </div>
          <div className={`max-w-[88%] px-4 py-2.5 text-small leading-relaxed rounded-xl ${
            msg.role === "user"
              ? "bg-signal/10 border border-signal/30 text-text-hi rounded-br-sm"
              : "bg-ink-700 border border-ink-600 text-text-hi rounded-bl-sm"
          }`}>
            {msg.content || <span className="text-text-lo italic">— navigated (no text) —</span>}
          </div>
          {msg.toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {msg.toolCalls.map((tc, i) => (
                <span key={i} className="font-mono text-[10px] px-2 py-0.5 bg-ink-900 border border-signal/20 rounded text-signal">
                  → {tc.name}({JSON.stringify(tc.args)})
                </span>
              ))}
            </div>
          )}
          {msg.sources.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {msg.sources.map((s, i) => (
                <span key={i} className="font-mono text-[10px] px-2 py-0.5 bg-ink-900 border border-ink-600 rounded text-text-lo">
                  📄 {s.title}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const [list, setList] = useState<ConversationsList | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [spend, setSpend] = useState<SpendStats | null>(null);
  const [filter, setFilter] = useState<"all" | "text" | "voice">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ConversationDetail | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [spendPeriod, setSpendPeriod] = useState<"today" | "week" | "month">("today");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (filter !== "all") params.set("type", filter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

    try {
      const [listData, statsData, spendData] = await Promise.all([
        apiFetch<ConversationsList>(`/chat/conversations?${params}`),
        apiFetch<Stats>("/chat/conversations-stats"),
        apiFetch<SpendStats>("/chat/spend").catch(() => null),
      ]);
      setList(listData);
      setStats(statsData);
      setSpend(spendData);
    } catch {
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [page, filter, debouncedSearch]);

  useEffect(() => { void load(); }, [load]);

  // Reset to page 1 when filter/search changes
  useEffect(() => { setPage(1); }, [filter, debouncedSearch]);

  async function handleDeleteConversation(id: string) {
    if (!confirm("Delete this conversation permanently?")) return;
    try {
      await apiFetch(`/chat/conversations/${id}`, { method: "DELETE" });
      toast.success("Conversation deleted");
      if (expandedId === id) setExpandedId(null);
      void load();
    } catch {
      toast.error("Failed to delete conversation");
    }
  }

  const totalPages = list ? Math.ceil(list.total / 20) : 1;

  return (
    <div>
      <PageHeader index="08 / CONVERSATIONS" title="Conversations" />

      {/* Stats row */}
      {(stats || spend) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {stats && [
            { label: "Today total",  value: String(stats.todayTotal) },
            { label: "Today chat",   value: String(stats.todayText) },
            { label: "Today voice",  value: String(stats.todayVoice) },
            { label: "All time",     value: String(stats.allTimeTotal) },
          ].map((s) => (
            <div key={s.label} className="bg-ink-800 border border-ink-600 rounded-card p-4">
              <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">{s.label}</p>
              <p className="font-mono text-2xl text-signal">{s.value}</p>
            </div>
          ))}
          {spend && (() => {
            const days = spend.last30DaysUsd ?? [];
            const periodSpend =
              spendPeriod === "today" ? (days[days.length - 1] ?? spend.todayUsd)
              : spendPeriod === "week"  ? days.slice(-7).reduce((a, b) => a + b, 0)
              : days.reduce((a, b) => a + b, 0);
            const periodPct = spend.ceilingUsd > 0
              ? Math.min(100, spendPeriod === "today"
                  ? spend.percentUsed
                  : (periodSpend / (spend.ceilingUsd * (spendPeriod === "week" ? 7 : 30))) * 100)
              : 0;
            const warn = spendPeriod === "today" ? spend.percentUsed > 80 : false;
            return (
              <div className="bg-ink-800 border border-ink-600 rounded-card p-4 col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest">LLM Spend</p>
                  <div className="flex gap-1">
                    {(["today", "week", "month"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSpendPeriod(p)}
                        className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded transition-colors ${
                          spendPeriod === p
                            ? "bg-signal text-signal-ink"
                            : "text-text-lo hover:text-text-hi"
                        }`}
                      >
                        {p === "today" ? "Day" : p === "week" ? "7d" : "30d"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <p className={`font-mono text-2xl ${warn ? "text-warn" : "text-signal"}`}>
                    ${periodSpend.toFixed(4)}
                  </p>
                  {spendPeriod === "today" && (
                    <p className="font-mono text-mono-label text-text-lo mb-0.5">
                      / ${spend.ceilingUsd.toFixed(2)} ({periodPct.toFixed(1)}%)
                    </p>
                  )}
                </div>
                <div className="mt-2 h-1 bg-ink-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, periodPct)}%`,
                      background: warn ? "var(--warn)" : "var(--signal)",
                    }}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          {(["all", "text", "voice"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono text-mono-label uppercase tracking-widest px-4 py-2 rounded-btn border transition-colors ${
                filter === f
                  ? "bg-signal text-signal-ink border-signal"
                  : "border-ink-600 text-text-mid hover:border-signal hover:text-text-hi"
              }`}
            >
              {f === "all" ? "All" : f === "text" ? "💬 Chat" : "🎙 Voice"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search messages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-ink-900 border border-ink-600 rounded-btn px-4 py-2 text-text-hi font-mono text-mono-label placeholder:text-text-lo focus:outline-none focus:border-signal"
        />
        <button
          onClick={() => void load()}
          className="font-mono text-mono-label uppercase tracking-widest px-4 py-2 border border-ink-600 rounded-btn text-text-mid hover:border-signal hover:text-signal transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading && (
        <p className="font-mono text-mono-label text-text-lo text-center py-16">Loading…</p>
      )}

      {!loading && list?.data.length === 0 && (
        <p className="font-mono text-mono-label text-text-lo text-center py-16">
          No conversations yet. They appear here as visitors use the chat or voice agent.
        </p>
      )}

      {!loading && list && list.data.length > 0 && (
        <div className="space-y-2">
          {list.data.map((conv) => {
            const isExpanded = expandedId === conv.id;
            return (
              <div
                key={conv.id}
                className={`bg-ink-800 border rounded-card overflow-hidden transition-colors ${
                  isExpanded ? "border-signal/50" : "border-ink-600 hover:border-signal/30"
                }`}
              >
                {/* Clickable header row */}
                <button
                  onClick={async () => {
                    if (isExpanded) { setExpandedId(null); setExpandedDetail(null); return; }
                    setExpandedId(conv.id);
                    setExpandedDetail(null);
                    setExpandedLoading(true);
                    try {
                      const d = await apiFetch<ConversationDetail>(`/chat/conversations/${conv.id}`);
                      setExpandedDetail(d);
                    } catch { setExpandedDetail(null); }
                    finally { setExpandedLoading(false); }
                  }}
                  className="w-full text-left px-5 py-4 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <TypeBadge type={conv.type} />
                      <span className="font-mono text-mono-label text-text-lo">
                        {conv.messageCount} msg{conv.messageCount !== 1 ? "s" : ""}
                      </span>
                      <span className="font-mono text-mono-label text-text-lo opacity-60">IP {conv.ipHash}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-mono text-[10px] text-text-lo opacity-60">{fmt(conv.createdAt)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDeleteConversation(conv.id); }}
                        className="font-mono text-[10px] text-text-lo hover:text-danger transition-colors px-1"
                        title="Delete conversation"
                      >
                        ×
                      </button>
                      <svg
                        width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                        className={`transition-colors flex-shrink-0 ${isExpanded ? "text-signal" : "text-text-lo"}`}
                        style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                      >
                        <path d="M5 6.5 L1 2.5 L9 2.5 Z" />
                      </svg>
                    </div>
                  </div>
                  {/* Voice: show AI summary preview; text: show first message */}
                  {conv.type === "voice" && conv.summary ? (
                    <p className={`mt-2 text-small line-clamp-1 transition-colors italic ${isExpanded ? "text-signal/80" : "text-signal/60 group-hover:text-signal/80"}`}>
                      {conv.summary}
                    </p>
                  ) : (
                    <p className={`mt-2 text-small line-clamp-1 transition-colors ${isExpanded ? "text-text-hi" : "text-text-mid group-hover:text-text-hi"}`}>
                      {conv.firstMessage || "(no messages)"}
                    </p>
                  )}
                </button>

                {/* Inline thread */}
                {isExpanded && (
                  <div className="border-t border-ink-600 px-5 py-4 max-h-[480px] overflow-y-auto">
                    <ConversationThread detail={expandedDetail} loading={expandedLoading} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="font-mono text-mono-label uppercase tracking-widest px-4 py-2 border border-ink-600 rounded-btn text-text-mid hover:border-signal hover:text-signal disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          <span className="font-mono text-mono-label text-text-lo">
            Page {page} / {totalPages} · {list?.total ?? 0} total
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="font-mono text-mono-label uppercase tracking-widest px-4 py-2 border border-ink-600 rounded-btn text-text-mid hover:border-signal hover:text-signal disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
