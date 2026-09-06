"use client";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { apiFetch } from "@/lib/admin-api";
import { PageHeader } from "@/components/admin/PageHeader";

interface DailyEvent {
  date: string;
  count: number;
}

interface TopPath {
  path: string;
  count: number;
}

interface AnalyticsSummary {
  totalPageViews: number;
  uniqueSessions: number;
  chatbotOpens: number;
  caseStudyReads: number;
  eventsByDay: DailyEvent[];
  topPaths: TopPath[];
}

interface AnalyticsEvent {
  type: string;
  metadata: Record<string, unknown>;
}

interface QuestionCount {
  question: string;
  count: number;
}

interface CountryCount {
  country: string;
  count: number;
}

interface SectionCount {
  section: string;
  count: number;
}

interface TimeOnSiteStats {
  avg: number;
  median: number;
  max: number;
}

interface MetricCardProps {
  label: string;
  value: number | string;
  index: string;
}

function MetricCard({ label, value, index }: MetricCardProps) {
  return (
    <div className="bg-ink-800 border border-ink-600 rounded-card p-6 flex flex-col gap-3">
      <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
        {index}
      </span>
      <span className="font-mono text-4xl text-signal leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-text-mid text-sm">{label}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800 border border-ink-600 rounded px-3 py-2">
      <p className="font-mono text-mono-label text-text-lo mb-1">{label}</p>
      <p className="font-mono text-signal text-sm">{payload[0].value} events</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

const REFRESH_INTERVAL_MS = 30_000;
const DETAILED_REFRESH_INTERVAL_MS = 60_000;
const FUNNEL_SECTIONS = ["skills", "experience", "projects", "case-studies", "open-source", "availability", "contact"];

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [topQuestions, setTopQuestions] = useState<QuestionCount[]>([]);

  // Detailed events state for the four new panels
  const [countryCounts, setCountryCounts] = useState<CountryCount[]>([]);
  const [timeOnSite, setTimeOnSite] = useState<TimeOnSiteStats | null>(null);
  const [lastSectionCounts, setLastSectionCounts] = useState<SectionCount[]>([]);
  const [sectionFunnel, setSectionFunnel] = useState<SectionCount[]>([]);

  const loadTopQuestions = useCallback(async () => {
    try {
      const data = await apiFetch<{ data: AnalyticsEvent[]; total: number }>("/analytics/events?page=1&limit=100");
      const events = data.data ?? [];
      const chatbotEvents = events.filter((e) => e.type === 'chatbot_query');
      const counts: Record<string, number> = {};
      for (const e of chatbotEvents) {
        const q = typeof e.metadata?.query === 'string' ? e.metadata.query.trim() : null;
        if (q) counts[q] = (counts[q] ?? 0) + 1;
      }
      const sorted = Object.entries(counts)
        .map(([question, count]) => ({ question, count }))
        .sort((a, b) => b.count - a.count);
      setTopQuestions(sorted);
    } catch {
      // non-fatal â€” questions panel stays empty
    }
  }, []);

  const loadDetailedEvents = useCallback(async () => {
    try {
      const data = await apiFetch<{ data: AnalyticsEvent[]; total: number }>("/analytics/events?limit=200");
      const events: AnalyticsEvent[] = data.data ?? [];

      // Panel 1 â€” Visitors by Country
      const pageViewsWithCountry = events.filter(
        (e) => e.type === "page_view" && typeof e.metadata?.country === "string"
      );
      const countryCounts: Record<string, number> = {};
      for (const e of pageViewsWithCountry) {
        const c = e.metadata.country as string;
        countryCounts[c] = (countryCounts[c] ?? 0) + 1;
      }
      const totalCountryHits = Object.values(countryCounts).reduce((a, b) => a + b, 0);
      const sortedCountries: CountryCount[] = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setCountryCounts(sortedCountries.map((c) => ({ ...c, total: totalCountryHits })));

      // Panel 2 â€” Time on Site
      const sessionEndEvents = events.filter(
        (e) =>
          e.type === "session_end" &&
          typeof e.metadata?.duration_seconds === "number"
      );
      if (sessionEndEvents.length > 0) {
        const durations = sessionEndEvents.map(
          (e) => e.metadata.duration_seconds as number
        );
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const median = computeMedian(durations);
        const max = Math.max(...durations);
        setTimeOnSite({ avg, median, max });
      } else {
        setTimeOnSite(null);
      }

      // Panel 3 â€” Where Visitors Stop (last section)
      const lastSectionEvents = events.filter(
        (e) =>
          e.type === "session_end" &&
          typeof e.metadata?.last_section === "string"
      );
      const lastSectionMap: Record<string, number> = {};
      for (const e of lastSectionEvents) {
        const s = e.metadata.last_section as string;
        lastSectionMap[s] = (lastSectionMap[s] ?? 0) + 1;
      }
      const sortedLastSections: SectionCount[] = Object.entries(lastSectionMap)
        .map(([section, count]) => ({ section, count }))
        .sort((a, b) => b.count - a.count);
      setLastSectionCounts(sortedLastSections);

      // Panel 4 â€” Section Funnel
      const sectionViewEvents = events.filter(
        (e) =>
          e.type === "section_view" &&
          typeof e.metadata?.section === "string"
      );
      const sectionViewMap: Record<string, number> = {};
      for (const e of sectionViewEvents) {
        const s = e.metadata.section as string;
        sectionViewMap[s] = (sectionViewMap[s] ?? 0) + 1;
      }
      const funnelData: SectionCount[] = FUNNEL_SECTIONS.map((section) => ({
        section,
        count: sectionViewMap[section] ?? 0,
      }));
      setSectionFunnel(funnelData);
    } catch {
      // non-fatal â€” detailed panels stay empty
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<AnalyticsSummary>("/analytics/summary");
      setSummary(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
    await loadTopQuestions();
  }, [loadTopQuestions]);

  useEffect(() => {
    void load();
    let interval = setInterval(() => { if (!document.hidden) void load(); }, REFRESH_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [load]);

  useEffect(() => {
    void loadDetailedEvents();
    const interval = setInterval(() => { if (!document.hidden) void loadDetailedEvents(); }, DETAILED_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadDetailedEvents]);

  const metrics = summary
    ? [
        { index: "01", label: "Total Page Views (30d)", value: summary.totalPageViews },
        { index: "02", label: "Unique Sessions (30d)", value: summary.uniqueSessions },
        { index: "03", label: "Chatbot Opens", value: summary.chatbotOpens },
        { index: "04", label: "Case Study Reads", value: summary.caseStudyReads },
      ]
    : [];

  // Compute total for country percentage column
  const countryTotal = countryCounts.reduce((a, c) => a + c.count, 0);

  // Compute max for last-section bar widths
  const lastSectionMax = lastSectionCounts.length > 0 ? lastSectionCounts[0]!.count : 1;

  // Compute drop-off percentages for funnel (relative to first tracked section: skills)
  const funnelBase = sectionFunnel.find((s) => s.section === "skills")?.count ?? 0;

  return (
    <div>
      <PageHeader index="06 / ANALYTICS" title="Analytics" />

      <div className="flex items-center gap-3 mb-8">
        {lastRefreshed && (
          <span className="font-mono text-mono-label text-text-lo">
            Last updated: {lastRefreshed.toLocaleTimeString()}
          </span>
        )}
        <span className="flex items-center gap-1.5 font-mono text-mono-label text-text-lo">
          <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
          Auto-refresh 30s
        </span>
        <button
          onClick={load}
          className="font-mono text-mono-label text-text-lo hover:text-text-hi border border-line rounded px-2.5 py-1 transition-colors ml-auto"
        >
          Refresh now
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-danger/10 border border-danger/30 rounded-card px-4 py-3 font-mono text-mono-label text-danger">
          {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="text-center py-24 font-mono text-mono-label text-text-lo">
          Loading analytics...
        </div>
      ) : summary ? (
        <div className="flex flex-col gap-8">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <MetricCard key={m.index} index={m.index} label={m.label} value={m.value} />
            ))}
          </div>

          {/* Bar Chart â€” events by day (last 14 days) */}
          <div className="bg-ink-800 border border-ink-600 rounded-card p-6">
            <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-6">
              Events by Day â€” Last 14 Days
            </h2>
            {summary.eventsByDay.length === 0 ? (
              <p className="text-text-lo font-mono text-mono-label text-center py-8">
                No event data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={summary.eventsByDay}
                  margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
                  barCategoryGap="35%"
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="#232A36"
                    strokeDasharray="0"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#5C6573", fontFamily: "var(--font-mono)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val: string) => {
                      const d = new Date(val);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis
                    tick={{ fill: "#5C6573", fontFamily: "var(--font-mono)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#161A22" }} />
                  <Bar dataKey="count" fill="#C6FF3A" radius={[3, 3, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Paths table */}
          <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line">
              <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
                Top Paths
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Path
                  </th>
                  <th className="text-right font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Views
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.topPaths.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-5 py-8 text-center text-text-lo font-mono text-mono-label"
                    >
                      No path data yet.
                    </td>
                  </tr>
                ) : (
                  summary.topPaths.map((row, i) => (
                    <tr
                      key={row.path}
                      className="border-b border-line last:border-0 hover:bg-ink-700 transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-sm text-text-hi">{row.path}</td>
                      <td className="px-5 py-3 text-right font-mono text-signal">
                        {row.count.toLocaleString()}
                        {i === 0 && (
                          <span className="ml-2 text-mono-label text-signal-dim text-xs">
                            TOP
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Most Asked Questions */}
          <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line">
              <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
                Most Asked Questions â€” Chatbot
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Question
                  </th>
                  <th className="text-right font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {topQuestions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-5 py-8 text-center text-text-lo font-mono text-mono-label"
                    >
                      No chatbot queries recorded yet.
                    </td>
                  </tr>
                ) : (
                  topQuestions.map((row, i) => (
                    <tr
                      key={row.question}
                      className="border-b border-line last:border-0 hover:bg-ink-700 transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-sm text-text-hi max-w-xl truncate">
                        {row.question}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-signal">
                        {row.count}
                        {i === 0 && (
                          <span className="ml-2 text-mono-label text-signal-dim text-xs">
                            TOP
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* â”€â”€â”€ PANEL 1 â€” Visitors by Country â”€â”€â”€ */}
          <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line">
              <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
                Visitors by Country â€” Top 10
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Country
                  </th>
                  <th className="text-right font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Sessions
                  </th>
                  <th className="text-right font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {countryCounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-text-lo font-mono text-mono-label"
                    >
                      No country data recorded yet.
                    </td>
                  </tr>
                ) : (
                  countryCounts.map((row) => {
                    const pct =
                      countryTotal > 0
                        ? ((row.count / countryTotal) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <tr
                        key={row.country}
                        className="border-b border-line last:border-0 hover:bg-ink-700 transition-colors"
                      >
                        <td className="px-5 py-3 font-mono text-sm text-text-hi">
                          {row.country}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-signal">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-mono-label text-text-mid">
                          {pct}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* â”€â”€â”€ PANEL 2 â€” Time on Site â”€â”€â”€ */}
          <div className="bg-ink-800 border border-ink-600 rounded-card p-5">
            <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-5">
              Time on Site
            </h2>
            {timeOnSite === null ? (
              <p className="text-text-lo font-mono text-mono-label text-center py-6">
                No session duration data recorded yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-ink-700 border border-ink-600 rounded-card p-5 flex flex-col gap-2">
                  <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
                    Avg Duration
                  </span>
                  <span className="font-mono text-3xl text-signal leading-none">
                    {formatDuration(timeOnSite.avg)}
                  </span>
                  <span className="text-text-mid text-sm">Average session length</span>
                </div>
                <div className="bg-ink-700 border border-ink-600 rounded-card p-5 flex flex-col gap-2">
                  <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
                    Median Duration
                  </span>
                  <span className="font-mono text-3xl text-signal leading-none">
                    {formatDuration(timeOnSite.median)}
                  </span>
                  <span className="text-text-mid text-sm">Middle value across sessions</span>
                </div>
                <div className="bg-ink-700 border border-ink-600 rounded-card p-5 flex flex-col gap-2">
                  <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
                    Max Duration
                  </span>
                  <span className="font-mono text-3xl text-signal leading-none">
                    {formatDuration(timeOnSite.max)}
                  </span>
                  <span className="text-text-mid text-sm">Longest single session</span>
                </div>
              </div>
            )}
          </div>

          {/* â”€â”€â”€ PANEL 3 â€” Where Visitors Stop â”€â”€â”€ */}
          <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line">
              <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
                Where Visitors Stop â€” Last Section Reached
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Section
                  </th>
                  <th className="text-right font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Count
                  </th>
                  <th className="w-40 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {lastSectionCounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-text-lo font-mono text-mono-label"
                    >
                      No last-section data recorded yet.
                    </td>
                  </tr>
                ) : (
                  lastSectionCounts.map((row) => {
                    const barPct =
                      lastSectionMax > 0
                        ? Math.round((row.count / lastSectionMax) * 100)
                        : 0;
                    return (
                      <tr
                        key={row.section}
                        className="border-b border-line last:border-0 hover:bg-ink-700 transition-colors"
                      >
                        <td className="px-5 py-3 font-mono text-sm text-text-hi capitalize">
                          {row.section}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-signal">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="h-1.5 w-full bg-ink-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-signal rounded-full"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* â”€â”€â”€ PANEL 4 â€” Section Funnel â”€â”€â”€ */}
          <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line">
              <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
                Section View Funnel
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Section
                  </th>
                  <th className="text-right font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Views
                  </th>
                  <th className="text-right font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">
                    Drop-off from Skills
                  </th>
                </tr>
              </thead>
              <tbody>
                {sectionFunnel.every((s) => s.count === 0) ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-text-lo font-mono text-mono-label"
                    >
                      No section view data recorded yet.
                    </td>
                  </tr>
                ) : (
                  sectionFunnel.map((row, i) => {
                    const dropOffPct =
                      funnelBase > 0 && i > 0
                        ? (((funnelBase - row.count) / funnelBase) * 100).toFixed(1)
                        : null;
                    return (
                      <tr
                        key={row.section}
                        className="border-b border-line last:border-0 hover:bg-ink-700 transition-colors"
                      >
                        <td className="px-5 py-3 font-mono text-sm text-text-hi capitalize">
                          {row.section}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-signal">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-mono-label">
                          {dropOffPct === null ? (
                            <span className="text-text-lo">baseline</span>
                          ) : (
                            <span
                              className={
                                parseFloat(dropOffPct) > 50
                                  ? "text-danger"
                                  : parseFloat(dropOffPct) > 25
                                  ? "text-warn"
                                  : "text-ok"
                              }
                            >
                              -{dropOffPct}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
