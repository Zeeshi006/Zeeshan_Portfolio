"use client";
import { useState, useEffect, useMemo, useRef } from "react";

interface ContributionDay { date: string; count: number; }
interface Props { weeks: ContributionDay[][]; totalThisYear: number; }

function cellColor(count: number): string {
  if (count === 0) return "#161A22";
  if (count <= 2)  return "#2A3A0F";
  if (count <= 5)  return "#4A6A1A";
  if (count <= 9)  return "#8FB82A";
  return "#C6FF3A";
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_HEADERS = ["M","T","W","T","F","S","S"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getAvailableMonths(weeks: ContributionDay[][]): { key: string; label: string; short: string }[] {
  const seen = new Set<string>();
  const result: { key: string; label: string; short: string }[] = [];
  weeks.forEach((week) => week.forEach((day) => {
    const d = new Date(day.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ key, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, short: MONTH_NAMES[d.getMonth()] ?? "" });
    }
  }));
  return result;
}

// ── Mobile: full-width calendar grid with day numbers ─────────────────────────
function CalendarGrid({ weeks, monthKey }: { weeks: ContributionDay[][]; monthKey: string }) {
  // Build date→count map
  const dayMap = useMemo(() => {
    const m = new Map<string, number>();
    weeks.forEach(week => week.forEach(day => m.set(day.date, day.count)));
    return m;
  }, [weeks]);

  // Parse year + month from key like "2026-04"
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr ?? "2026", 10);
  const month = parseInt(monthStr ?? "1", 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Which day-of-week does the 1st fall on? Convert to Mon=0 … Sun=6
  const rawFirst = new Date(year, month - 1, 1).getDay(); // JS: 0=Sun
  const firstDayMon = rawFirst === 0 ? 6 : rawFirst - 1;

  // Build cell array: null = empty padding, number = day of month
  const cells: (number | null)[] = [
    ...Array(firstDayMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
        {DAY_HEADERS.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#5C6573", letterSpacing: "0.05em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells — fill full width via 1fr columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} style={{ aspectRatio: "1" }} />;
          }
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = dayMap.get(dateStr) ?? 0;
          const isHot = count >= 9;
          const isMid = count >= 5;
          return (
            <div
              key={i}
              title={`${count} contribution${count !== 1 ? "s" : ""} on ${dateStr}`}
              style={{
                aspectRatio: "1",
                borderRadius: "5px",
                backgroundColor: cellColor(count),
                boxShadow: isHot ? "0 0 10px rgba(198,255,58,0.55)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "9px",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                color: isMid ? "#14210A" : "#5C6573",
                userSelect: "none",
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Desktop: classic week-column heatmap ──────────────────────────────────────
function DesktopHeatmap({ weeks }: { weeks: ContributionDay[][] }) {
  const CELL = 11; const GAP = 2;
  const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let last = -1;
    weeks.forEach((week, col) => {
      const d = week[0];
      if (!d) return;
      const m = new Date(d.date).getMonth();
      if (m !== last) { labels.push({ label: MONTH_NAMES[m] ?? "", col }); last = m; }
    });
    return labels;
  }, [weeks]);

  return (
    <div style={{ position: "relative", paddingTop: "20px", paddingLeft: "32px" }}>
      <div style={{ position: "absolute", top: 0, left: "32px" }}>
        {monthLabels.map(({ label, col }) => (
          <span key={`${label}-${col}`} style={{ position: "absolute", left: `${col * (CELL + GAP)}px`, fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#5C6573", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
            {label}
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, top: "20px", display: "flex", flexDirection: "column", gap: `${GAP}px` }}>
        {DAYS.map((d, i) => (
          <div key={i} style={{ height: `${CELL}px`, fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: "#5C6573", display: "flex", alignItems: "center" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: `${GAP}px` }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: `${GAP}px` }}>
            {week.map((day) => (
              <div key={day.date} title={`${day.count} on ${day.date}`}
                style={{ width: `${CELL}px`, height: `${CELL}px`, borderRadius: "2px", backgroundColor: cellColor(day.count), transition: "opacity 150ms" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0.7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ContributionHeatmap({ weeks, totalThisYear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const availableMonths = useMemo(() => getAvailableMonths(weeks), [weeks]);
  const [selectedIdx, setSelectedIdx] = useState(() => Math.max(0, availableMonths.length - 1));

  useEffect(() => { setSelectedIdx(Math.max(0, availableMonths.length - 1)); }, [availableMonths.length]);

  // Scroll selected pill into center view — use scrollLeft to avoid moving the page viewport
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const pill = container.children[selectedIdx] as HTMLElement | undefined;
    if (!pill) return;
    const offset = pill.offsetLeft - container.clientWidth / 2 + pill.offsetWidth / 2;
    container.scrollTo({ left: offset, behavior: "smooth" });
  }, [selectedIdx]);

  const selectedMonth = availableMonths[selectedIdx];

  const monthWeeks = useMemo(() => {
    if (!selectedMonth) return weeks;
    return weeks.filter((week) => week.some((day) => {
      const d = new Date(day.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === selectedMonth.key;
    }));
  }, [weeks, selectedMonth]);

  const monthTotal = useMemo(
    () => monthWeeks.reduce((sum, w) => sum + w.reduce((s, d) => s + d.count, 0), 0),
    [monthWeeks]
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="section-index">CONTRIBUTIONS</p>
        <span className="font-mono text-mono-label text-signal">{totalThisYear.toLocaleString()} this year</span>
      </div>

      {/* ── Mobile ── */}
      <div className="sm:hidden">
        {/* Scrollable month strip */}
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 mb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {availableMonths.map((m, i) => (
            <button key={m.key} onClick={() => setSelectedIdx(i)}
              className={`flex-shrink-0 font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md transition-all ${
                i === selectedIdx
                  ? "bg-signal text-signal-ink font-semibold"
                  : "border border-ink-600 text-text-lo hover:border-signal hover:text-signal"
              }`}>
              {m.short}
            </button>
          ))}
        </div>

        {/* Month + total */}
        <div className="flex items-baseline justify-between mb-4">
          <span className="font-mono text-small text-text-mid">{selectedMonth?.label}</span>
          <span className="font-mono text-mono-label text-signal">{monthTotal} commits</span>
        </div>

        {/* Calendar grid */}
        {selectedMonth && (
          <CalendarGrid weeks={monthWeeks} monthKey={selectedMonth.key} />
        )}
      </div>

      {/* ── Desktop ── */}
      <div className="hidden sm:block overflow-x-auto pb-1">
        <DesktopHeatmap weeks={weeks} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="font-mono text-mono-label text-text-lo">Less</span>
        {["#161A22","#2A3A0F","#4A6A1A","#8FB82A","#C6FF3A"].map((c) => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: c }} />
        ))}
        <span className="font-mono text-mono-label text-text-lo">More</span>
      </div>
    </div>
  );
}
