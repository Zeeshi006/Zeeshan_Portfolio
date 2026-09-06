"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SystemMetrics {
  api: { p50Ms: number; p99Ms: number; uptimeSeconds: number; sampleSize: number };
  db: { activeConnections: number; txnPerMinute: number };
  redis: { hitRatePct: number; memoryUsed: string };
  rag: { docCount: number; avgEmbedMs: number | null };
  history?: {
    p50: number[];
    p99: number[];
    connections: number[];
    txnPerMin: number[];
    visitors: number[];
  };
  visitorsOnline: number;
  timestamp: number;
}

interface RequestEvent {
  method: string;
  path: string;
  status: number;
  ms: number;
  ts: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":    return "#99A2B2";
    case "POST":   return "#C6FF3A";
    case "PUT":
    case "PATCH":  return "#FFB020";
    case "DELETE": return "#F85149";
    default:       return "#5C6573";
  }
}

function statusColor(status: number): string {
  if (status < 300) return "#3FB950";
  if (status < 400) return "#99A2B2";
  if (status < 500) return "#FFB020";
  return "#F85149";
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, height = 36 }: { data: number[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center" style={{ height }}>
        <span className="font-mono text-[9px] text-text-lo uppercase tracking-widest">
          collecting…
        </span>
      </div>
    );
  }

  const W = 200;
  const H = height;
  const PAD = 3;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - PAD - ((v - min) / range) * (H - PAD * 2),
  ] as [number, number]);

  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      preserveAspectRatio="none"
    >
      <path d={area} fill="rgba(198,255,58,0.07)" />
      <path d={line} fill="none" stroke="#C6FF3A" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function BarFill({ pct, max }: { pct: number; max: number }) {
  const fill = Math.min(100, Math.round((pct / max) * 100));
  return (
    <div className="w-full h-1.5 bg-ink-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-signal rounded-full transition-all duration-700 ease-out"
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}

function MetricRow({
  label,
  value,
  unit = "",
  bar,
  barMax,
  sparkData,
}: {
  label: string;
  value: number | string;
  unit?: string;
  bar?: number;
  barMax?: number;
  sparkData?: number[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">{label}</span>
        <span className="font-mono text-sm text-text-hi tabular-nums">
          {value}
          {unit && <span className="text-text-lo ml-0.5 text-xs">{unit}</span>}
        </span>
      </div>
      {sparkData && sparkData.length > 0 ? (
        <Sparkline data={sparkData} />
      ) : bar !== undefined && barMax !== undefined ? (
        <BarFill pct={bar} max={barMax} />
      ) : null}
    </div>
  );
}

function StatusDot({ ok = true }: { ok?: boolean }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${
        ok ? "bg-signal animate-pulse" : "bg-danger"
      }`}
    />
  );
}

function Card({
  title,
  badge,
  children,
  className = "",
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-ink-800 border border-ink-600 rounded-xl p-6 flex flex-col gap-5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">{title}</span>
        {badge ?? (
          <span className="flex items-center font-mono text-[10px] text-signal uppercase tracking-widest">
            <StatusDot />LIVE
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-ink-800 border border-ink-600 rounded-xl h-52" />
      ))}
      <div className="md:col-span-2 bg-ink-800 border border-ink-600 rounded-xl h-28" />
      <div className="md:col-span-2 bg-ink-800 border border-ink-600 rounded-xl h-48" />
    </div>
  );
}

// ── Live request feed ─────────────────────────────────────────────────────────

function RequestFeed({ events }: { events: RequestEvent[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-ink-800 border border-ink-600 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line">
        <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">
          Live Request Stream · /metrics
        </span>
        <span className="flex items-center gap-2 font-mono text-[10px] text-signal uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
          Streaming
        </span>
      </div>

      <div className="divide-y divide-line">
        {events.length === 0 ? (
          <div className="px-6 py-5 flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-text-lo animate-pulse" />
            <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">
              Waiting for requests…
            </span>
          </div>
        ) : (
          events.map((e, i) => (
            <div
              key={i}
              className="grid px-6 py-2.5 gap-x-3 items-center"
              style={{ gridTemplateColumns: "3rem 1fr 3rem 4rem" }}
            >
              <span
                className="font-mono text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: methodColor(e.method) }}
              >
                {e.method}
              </span>
              <span className="font-mono text-[11px] text-text-mid truncate">{e.path}</span>
              <span
                className="font-mono text-[11px] tabular-nums text-right"
                style={{ color: statusColor(e.status) }}
              >
                {e.status}
              </span>
              <span className="font-mono text-[11px] text-text-lo tabular-nums text-right">
                {e.ms}ms
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Infrastructure Topology ───────────────────────────────────────────────────
// Canvas node-graph: Browser → Nginx → NestJS → [PostgreSQL | Redis | pgvector]
// Particles travel along edges on each live request event.

const LW = 720; // logical canvas width
const LH = 260; // logical canvas height

interface NodeSpec {
  id: string;
  cx: number; cy: number;
  w: number;  h: number;
  label: string;
  sub: string;
}

const TOPO_NODES: NodeSpec[] = [
  { id: "browser", cx:  58, cy: 130, w:  88, h: 44, label: "Browser",    sub: "CLIENT"   },
  { id: "nginx",   cx: 210, cy: 130, w:  76, h: 44, label: "Caddy",      sub: "PROXY"    },
  { id: "nestjs",  cx: 390, cy: 130, w:  80, h: 44, label: "NestJS",     sub: "API"      },
  { id: "pg",      cx: 610, cy:  48, w: 108, h: 44, label: "PostgreSQL", sub: "DATABASE" },
  { id: "redis",   cx: 610, cy: 130, w:  76, h: 44, label: "Redis",      sub: "CACHE"    },
  { id: "pgv",     cx: 610, cy: 212, w:  96, h: 44, label: "pgvector",   sub: "VECTOR"   },
];

interface Seg {
  x1: number; y1: number;
  x2: number; y2: number;
  cpx?: number; cpy?: number; // quadratic bezier control point
}

function nodePt(id: string, side: "r" | "l"): [number, number] {
  const n = TOPO_NODES.find((n) => n.id === id)!;
  return [side === "r" ? n.cx + n.w / 2 : n.cx - n.w / 2, n.cy];
}

function makeSeg(a: string, b: string, cpx?: number, cpy?: number): Seg {
  const [x1, y1] = nodePt(a, "r");
  const [x2, y2] = nodePt(b, "l");
  const seg: Seg = { x1, y1, x2, y2 };
  if (cpx !== undefined && cpy !== undefined) { seg.cpx = cpx; seg.cpy = cpy; }
  return seg;
}

const TOPO_SEGS: Record<string, Seg> = {
  "browser-nginx":  makeSeg("browser", "nginx"),
  "nginx-nestjs":   makeSeg("nginx",   "nestjs"),
  "nestjs-pg":      makeSeg("nestjs",  "pg",   493,  48),
  "nestjs-redis":   makeSeg("nestjs",  "redis"),
  "nestjs-pgv":     makeSeg("nestjs",  "pgv",  493, 212),
};

const TOPO_PATHS: Record<string, string[]> = {
  pg:    ["browser", "nginx", "nestjs", "pg"],
  redis: ["browser", "nginx", "nestjs", "redis"],
  pgv:   ["browser", "nginx", "nestjs", "pgv"],
};

function routeEvent(path: string): string {
  if (/\/chat/.test(path)) return "pgv";
  if (/\/system|\/total-views/.test(path)) return "redis";
  return "pg";
}

function bezPt(seg: Seg, t: number): [number, number] {
  if (seg.cpx !== undefined && seg.cpy !== undefined) {
    const mt = 1 - t;
    return [
      mt * mt * seg.x1 + 2 * mt * t * seg.cpx + t * t * seg.x2,
      mt * mt * seg.y1 + 2 * mt * t * seg.cpy  + t * t * seg.y2,
    ];
  }
  return [seg.x1 + (seg.x2 - seg.x1) * t, seg.y1 + (seg.y2 - seg.y1) * t];
}

interface Particle {
  id: number;
  nodes: string[];
  si: number;   // current segment index
  t: number;    // 0–1 progress within segment
  speed: number;
  color: string;
  trail: Array<[number, number, number]>; // x, y, alpha
}

let _topoId = 0;

function spawnTopoParticle(e: RequestEvent, arr: Particle[]) {
  const dest = routeEvent(e.path);
  const color = e.status < 300 ? "#C6FF3A" : e.status < 500 ? "#FFB020" : "#F85149";
  // Faster response → faster particle (clamped between 0.006 and 0.022 per frame)
  const speed = Math.max(0.006, Math.min(0.022, 500 / (e.ms * 60 + 500)));
  arr.push({ id: _topoId++, nodes: TOPO_PATHS[dest] ?? TOPO_PATHS["pg"]!, si: 0, t: 0, speed, color, trail: [] });
  if (arr.length > 50) arr.splice(0, arr.length - 50);
}

function advanceTopoParticles(arr: Particle[]) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    if (!p) continue;
    const seg = TOPO_SEGS[`${p.nodes[p.si] ?? ""}-${p.nodes[p.si + 1] ?? ""}`];
    if (!seg) { arr.splice(i, 1); continue; }
    const [px, py] = bezPt(seg, p.t);
    p.trail.push([px, py, 1]);
    if (p.trail.length > 8) p.trail.shift();
    for (let j = 0; j < p.trail.length; j++) {
      const pt = p.trail[j];
      if (pt) pt[2] = ((j + 1) / p.trail.length) * 0.5;
    }
    p.t += p.speed;
    if (p.t >= 1) { p.si++; p.t = 0; }
    if (p.si >= p.nodes.length - 1) arr.splice(i, 1);
  }
}

function toHex2(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
}

function topoNodeHealthColor(id: string, m: SystemMetrics | null): string {
  if (!m) return "#1E2430";
  switch (id) {
    case "nestjs": return m.api.p50Ms < 80 ? "#3FB950" : m.api.p50Ms < 250 ? "#FFB020" : "#F85149";
    case "pg":     return m.db.activeConnections < 10 ? "#3FB950" : m.db.activeConnections < 20 ? "#FFB020" : "#F85149";
    case "redis":  return m.redis.hitRatePct > 70 ? "#C6FF3A" : m.redis.hitRatePct > 30 ? "#FFB020" : "#F85149";
    case "pgv":    return m.rag.docCount > 0 ? "#3FB950" : "#5C6573";
    default:       return "#232A36";
  }
}

function topoNodeMetric(id: string, m: SystemMetrics | null): string {
  if (!m) return "";
  switch (id) {
    case "nestjs": return `${m.api.p50Ms}ms`;
    case "pg":     return `${m.db.activeConnections} conn`;
    case "redis":  return `${m.redis.hitRatePct}% hit`;
    case "pgv":    return `${m.rag.docCount} docs`;
    default:       return "";
  }
}

function rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTopoFrame(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  m: SystemMetrics | null,
  flashes: Map<string, number>,
  now: number,
) {
  ctx.clearRect(0, 0, LW, LH);

  // Animated dashed edges
  ctx.save();
  ctx.strokeStyle = "#232A36";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.lineDashOffset = -((now / 50) % 12);
  for (const seg of Object.values(TOPO_SEGS)) {
    ctx.beginPath();
    if (seg.cpx !== undefined && seg.cpy !== undefined) {
      ctx.moveTo(seg.x1, seg.y1);
      ctx.quadraticCurveTo(seg.cpx, seg.cpy, seg.x2, seg.y2);
    } else {
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Particle trails
  ctx.save();
  ctx.setLineDash([]);
  for (const p of particles) {
    for (const [tx, ty, ta] of p.trail) {
      ctx.beginPath();
      ctx.arc(tx, ty, 2, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${toHex2(ta * 255)}`;
      ctx.fill();
    }
  }
  ctx.restore();

  // Particle heads (glowing dots)
  ctx.save();
  ctx.setLineDash([]);
  for (const p of particles) {
    if (p.si >= p.nodes.length - 1) continue;
    const seg = TOPO_SEGS[`${p.nodes[p.si]}-${p.nodes[p.si + 1]}`];
    if (!seg) continue;
    const [px, py] = bezPt(seg, p.t);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // Nodes
  ctx.save();
  ctx.setLineDash([]);
  for (const n of TOPO_NODES) {
    const nx = n.cx - n.w / 2;
    const ny = n.cy - n.h / 2;

    const flashTs = flashes.get(n.id) ?? 0;
    const fa = Math.max(0, 1 - (now - flashTs) / 1500);
    const hc = topoNodeHealthColor(n.id, m);

    // Node fill with optional glow
    if (fa > 0.02) {
      ctx.shadowColor = hc;
      ctx.shadowBlur = 20 * fa;
    } else {
      ctx.shadowBlur = 0;
    }
    rrPath(ctx, nx, ny, n.w, n.h, 8);
    ctx.fillStyle = "#0F1218";
    ctx.fill();
    ctx.shadowBlur = 0;

    // Health-colored border
    rrPath(ctx, nx, ny, n.w, n.h, 8);
    ctx.strokeStyle = fa > 0.08 ? `${hc}${toHex2(fa * 200 + 55)}` : hc;
    ctx.lineWidth = fa > 0.08 ? 1.5 : 1;
    ctx.stroke();

    // Node label (main)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 11px "JetBrains Mono", monospace`;
    ctx.fillStyle = "#E8ECF2";
    ctx.fillText(n.label, n.cx, n.cy - 7);

    // Node sub-label (metric or category)
    const metric = topoNodeMetric(n.id, m);
    ctx.font = `9px "JetBrains Mono", monospace`;
    if (metric) {
      ctx.fillStyle = hc === "#C6FF3A" ? "#C6FF3A" : "#99A2B2";
      ctx.fillText(metric.toUpperCase(), n.cx, n.cy + 8);
    } else {
      ctx.fillStyle = "#5C6573";
      ctx.fillText(n.sub, n.cx, n.cy + 8);
    }
  }
  ctx.restore();
}

function InfraTopology({ metrics }: { metrics: SystemMetrics | null }) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const metricsRef = useRef<SystemMetrics | null>(metrics);
  const flashes = useRef<Map<string, number>>(new Map());
  const rafId   = useRef<number>(0);

  useEffect(() => { metricsRef.current = metrics; }, [metrics]);

  // Separate WebSocket connection for topology particle events
  useEffect(() => {
    const API = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    const socket = io(`${API}/metrics`, { path: "/socket.io" });
    socket.on("request", (e: RequestEvent) => {
      spawnTopoParticle(e, particles.current);
      const dest = routeEvent(e.path);
      const now = Date.now();
      ["browser", "nginx", "nestjs", dest].forEach((id) => flashes.current.set(id, now));
    });
    return () => { socket.disconnect(); };
  }, []);

  // ResizeObserver — keep canvas pixel dimensions in sync with container CSS size
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const cssW = entry.contentRect.width;
      const cssH = cssW * (LH / LW);
      const dpr = window.devicePixelRatio ?? 1;
      canvas.width  = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width  = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // rAF render loop — scale logical 720×260 coords to device pixels each frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function frame() {
      const ctx = canvas!.getContext("2d");
      if (!ctx) { rafId.current = requestAnimationFrame(frame); return; }
      const dpr  = window.devicePixelRatio ?? 1;
      const cssW = canvas!.width / dpr;
      const s    = cssW / LW; // CSS pixels per logical unit
      // Map logical coords → device pixels in one transform
      ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
      advanceTopoParticles(particles.current);
      drawTopoFrame(ctx, particles.current, metricsRef.current, flashes.current, Date.now());
      rafId.current = requestAnimationFrame(frame);
    }
    rafId.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

// ── System narrator ────────────────────────────────────────────────────────────

function SystemNarrator({ m }: { m: SystemMetrics }) {
  const [idx,   setIdx]   = useState(0);
  const [faded, setFaded] = useState(false);

  const phrases = [
    `API — p50 ${m.api.p50Ms}ms · p99 ${m.api.p99Ms}ms · ${m.api.sampleSize.toLocaleString()} lifetime requests served`,
    `Redis cache ${m.redis.hitRatePct}% hit rate · ${m.redis.memoryUsed} heap · rate-limit and session layer active`,
    `PostgreSQL — ${m.db.activeConnections} active connections · ${m.db.txnPerMinute} txn/min · Prisma ORM`,
    `RAG pipeline — ${m.rag.docCount} KB docs indexed · pgvector cosine similarity · DeepSeek V4 Flash`,
    `${m.visitorsOnline} visitor${m.visitorsOnline !== 1 ? "s" : ""} online · uptime ${formatUptime(m.api.uptimeSeconds)} · ${m.api.sampleSize.toLocaleString()} requests served`,
  ];

  useEffect(() => {
    const len = phrases.length;
    const id = setInterval(() => {
      setFaded(true);
      setTimeout(() => { setIdx((i) => (i + 1) % len); setFaded(false); }, 350);
    }, 5_000);
    return () => clearInterval(id);
  // phrases.length is always 5 — stable dep, intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-line mb-6">
      <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse shrink-0 mt-[3px]" />
      <span
        className="font-mono text-[10px] text-text-mid tracking-wider transition-opacity duration-300 flex-1 leading-relaxed"
        style={{ opacity: faded ? 0 : 1 }}
      >
        {phrases[idx]}
      </span>
      <span className="shrink-0 font-mono text-[9px] text-text-lo tabular-nums mt-[2px]">
        {idx + 1} / {phrases.length}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SystemPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [error, setError] = useState(false);
  const [age, setAge] = useState(0);
  const [feed, setFeed] = useState<RequestEvent[]>([]);
  const lastFetch = useRef<number>(0);

  useEffect(() => {
    const API = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

    async function fetchMetrics() {
      try {
        const res = await fetch(`${API}/system/metrics`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as SystemMetrics;
        setMetrics(data);
        lastFetch.current = Date.now();
        setAge(0);
        setError(false);
      } catch {
        setError(true);
      }
    }

    void fetchMetrics();
    const poll = setInterval(() => void fetchMetrics(), 5_000);
    const tick = setInterval(() => {
      if (lastFetch.current) setAge(Math.floor((Date.now() - lastFetch.current) / 1000));
    }, 1_000);

    return () => { clearInterval(poll); clearInterval(tick); };
  }, []);

  useEffect(() => {
    const API = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    const socket = io(`${API}/metrics`, { path: "/socket.io" });
    socket.on("request", (event: RequestEvent) => {
      setFeed((prev) => [event, ...prev].slice(0, 20));
    });
    return () => { socket.disconnect(); };
  }, []);

  const m = metrics;

  return (
    <main className="min-h-screen bg-ink-900 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(35,42,54,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(35,42,54,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12">
          <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mb-4">
            01 / SYSTEM
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-display-l text-text-hi tracking-tight leading-none mb-2">
                Live Infrastructure
              </h1>
              <p className="font-body text-text-mid text-sm max-w-md">
                Real-time metrics from the NestJS API, PostgreSQL, Redis, and RAG pipeline — collected every 5 seconds.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-signal animate-pulse" />
              <span className="font-mono text-[10px] text-signal uppercase tracking-widest">
                {error ? "DEGRADED" : m ? `UPDATED ${age}s AGO` : "CONNECTING…"}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-line mb-0" />

        {m && <SystemNarrator m={m} />}

        {!m && !error ? (
          <Skeleton />
        ) : error && !m ? (
          <div className="flex items-center gap-3 bg-danger/10 border border-danger/20 rounded-xl px-6 py-5">
            <span className="w-2 h-2 rounded-full bg-danger" />
            <p className="font-mono text-mono-label text-danger">
              METRICS UNAVAILABLE — API unreachable
            </p>
          </div>
        ) : m ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── Topology diagram (full width, top) ── */}
            <div className="md:col-span-2 bg-ink-800 border border-ink-600 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">
                    Request Flow · Live Infrastructure Topology
                  </span>
                  <span className="hidden sm:block font-mono text-[9px] text-text-lo">
                    particles = live requests · color: <span style={{ color: "#C6FF3A" }}>2xx</span> / <span style={{ color: "#FFB020" }}>4xx</span> / <span style={{ color: "#F85149" }}>5xx</span>
                  </span>
                </div>
                <span className="flex items-center gap-2 font-mono text-[10px] text-signal uppercase tracking-widest shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                  Live
                </span>
              </div>
              <div className="p-4 sm:p-6 pb-4 min-h-[160px]">
                <InfraTopology metrics={m} />
              </div>
            </div>

            {/* API */}
            <Card title="API · NestJS">
              <MetricRow label="Latency p50" value={m.api.p50Ms} unit="ms" sparkData={m.history?.p50 ?? []} bar={m.api.p50Ms} barMax={250} />
              <MetricRow label="Latency p99" value={m.api.p99Ms} unit="ms" sparkData={m.history?.p99 ?? []} bar={m.api.p99Ms} barMax={500} />
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mb-1">Uptime</p>
                  <p className="font-mono text-sm text-text-hi">{formatUptime(m.api.uptimeSeconds)}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mb-1">Samples</p>
                  <p className="font-mono text-sm text-text-hi">{m.api.sampleSize.toLocaleString()}</p>
                </div>
              </div>
            </Card>

            {/* Database */}
            <Card title="Database · PostgreSQL 17 + pgvector">
              <MetricRow label="Active connections" value={m.db.activeConnections} sparkData={m.history?.connections ?? []} bar={m.db.activeConnections} barMax={20} />
              <MetricRow label="Transactions / min" value={m.db.txnPerMinute} sparkData={m.history?.txnPerMin ?? []} bar={m.db.txnPerMinute} barMax={200} />
              <div className="flex items-center gap-2 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">
                  Prisma ORM · Connection pooling active
                </span>
              </div>
            </Card>

            {/* Redis */}
            <Card title="Cache · Redis 7">
              <MetricRow label="Hit rate" value={m.redis.hitRatePct} unit="%" bar={m.redis.hitRatePct} barMax={100} />
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mb-1">Memory</p>
                  <p className="font-mono text-sm text-text-hi">{m.redis.memoryUsed}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mb-1">Purpose</p>
                  <p className="font-mono text-sm text-text-mid">Rate limits, sessions</p>
                </div>
              </div>
            </Card>

            {/* RAG */}
            <Card title="RAG Pipeline · DeepSeek + pgvector">
              <MetricRow label="KB documents" value={m.rag.docCount} bar={m.rag.docCount} barMax={100} />
              {m.rag.avgEmbedMs !== null ? (
                <MetricRow label="Avg embed latency" value={m.rag.avgEmbedMs} unit="ms" bar={m.rag.avgEmbedMs} barMax={500} />
              ) : (
                <div>
                  <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mb-1">Avg embed latency</p>
                  <p className="font-mono text-sm text-text-lo">No queries yet</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">
                  text-embedding-3-small · 1536d
                </span>
              </div>
            </Card>

            {/* Visitors */}
            <div className="md:col-span-2 bg-ink-800 border border-ink-600 rounded-xl px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">
                  Visitors · WebSocket
                </span>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                  <span className="font-mono text-[10px] text-signal uppercase tracking-widest">
                    {m.visitorsOnline} ONLINE NOW
                  </span>
                </div>
              </div>
              <div className="grid md:grid-cols-[1fr_200px] gap-6 items-end">
                <div className="flex gap-1.5 flex-wrap">
                  {[...Array(Math.max(20, m.visitorsOnline))].map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-sm transition-colors duration-500 ${
                        i < m.visitorsOnline ? "bg-signal" : "bg-ink-700"
                      }`}
                    />
                  ))}
                </div>
                <div>
                  <p className="font-mono text-[9px] text-text-lo uppercase tracking-widest mb-1">
                    30-point trend
                  </p>
                  <Sparkline data={m.history?.visitors ?? []} height={32} />
                </div>
              </div>
              <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mt-3">
                Connected via Socket.IO · /online namespace
              </p>
            </div>

            {/* Live request feed */}
            <div className="md:col-span-2">
              <RequestFeed events={feed} />
            </div>


          </div>
        ) : null}

        <div className="mt-10 flex items-start gap-3">
          <div className="w-px h-12 bg-line shrink-0 mt-1" />
          <p className="font-mono text-[10px] text-text-lo leading-relaxed">
            All metrics are aggregate and anonymous. No user PII is exposed.
            <br />
            Source: NestJS API · PostgreSQL pg_stat_database · Redis INFO · pgvector kb_documents
          </p>
        </div>
      </div>
    </main>
  );
}
