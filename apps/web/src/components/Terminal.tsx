"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ── Types ─────────────────────────────────────────────────────────────────────

type LineType = "prompt" | "out" | "err" | "dim" | "lime" | "amber" | "blank" | "json";

interface TermLine {
  id: number;
  text: string;
  type: LineType;
}

interface KBChunk {
  id: string;
  title: string;
  excerpt: string;
}

interface RequestEvent {
  method: string;
  path: string;
  status: number;
  ms: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _lid = 0;
const L = (text: string, type: LineType = "out"): TermLine => ({ id: _lid++, text, type });
const BLANK = (): TermLine => L("", "blank");

function jsonLines(data: unknown): TermLine[] {
  const raw = JSON.stringify(data, null, 2);
  const truncated = raw.length > 3000 ? raw.slice(0, 3000) + "\n  … (truncated)" : raw;
  return truncated.split("\n").map((t) => L("  " + t, "json"));
}

function methodColor(m: string): string {
  if (m === "GET")    return "#99A2B2";
  if (m === "POST")   return "#C6FF3A";
  if (m === "DELETE") return "#F85149";
  return "#FFB020";
}

function statusColor(s: number): string {
  if (s < 300) return "#3FB950";
  if (s < 500) return "#FFB020";
  return "#F85149";
}

// ── Syntax-coloured JSON renderer ─────────────────────────────────────────────

function JsonLine({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // keys: amber
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span style="color:#FFB020">$1</span>$2')
    // string values: teal
    .replace(/(?<=:\s*)("(?:[^"\\]|\\.)*")/g, '<span style="color:#3FB950">$1</span>')
    // numbers: lime
    .replace(/(?<=:\s*)(-?\d+\.?\d*)/g, '<span style="color:#C6FF3A">$1</span>')
    // booleans / null: dim
    .replace(/(?<=:\s*)(true|false|null)/g, '<span style="color:#99A2B2">$1</span>');
  return (
    <span
      className="font-mono text-[11px] leading-relaxed text-text-mid"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Boot message ──────────────────────────────────────────────────────────────

const BOOT: TermLine[] = [
  L("Portfolio Terminal — NestJS · pgvector · Redis · DeepSeek", "lime"),
  L("─".repeat(58), "dim"),
  L('type "help" for available commands', "dim"),
  BLANK(),
];

const HELP: TermLine[] = [
  L("commands:", "lime"),
  BLANK(),
  L("  rag <query>   semantic search across the knowledge base", "out"),
  L("  GET <path>    HTTP GET  →  GET /content/projects", "out"),
  L("  ping          measure API round-trip latency", "out"),
  L("  tail          stream live requests  (ctrl+c to stop)", "out"),
  L("  clear         clear terminal", "out"),
  BLANK(),
  L("  tab to autocomplete · ↑↓ for history", "dim"),
  BLANK(),
];

const CMD_PREFIXES = ["rag ", "GET /", "ping", "tail", "help", "clear"];
const COMMON_PATHS = [
  "/content/projects", "/content/skills", "/content/experiences",
  "/content/site/hero", "/content/site/about", "/system/metrics",
  "/health", "/chat/kb", "/analytics/total-views", "/blog/posts", "/github",
];

// ── Terminal component ────────────────────────────────────────────────────────

export function Terminal() {
  const API = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
  const [lines, setLines] = useState<TermLine[]>(BOOT);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [tailing, setTailing] = useState(false);
  const tailRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  // Focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Staggered line append
  const addLines = useCallback((newLines: TermLine[], delay = 14) => {
    newLines.forEach((l, i) => {
      setTimeout(() => {
        setLines((prev) => [...prev.slice(-120), l]);
      }, i * delay);
    });
    return newLines.length * delay;
  }, []);

  const stopTail = useCallback(() => {
    tailRef.current?.disconnect();
    tailRef.current = null;
    setTailing(false);
    addLines([BLANK(), L("  [ctrl+c] — stopped", "dim"), BLANK()]);
  }, [addLines]);

  // ── Command runner ──────────────────────────────────────────────────────────

  const run = useCallback(async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;

    setHistory((h) => [cmd, ...h.slice(0, 49)]);
    setHistIdx(-1);
    setLines((prev) => [...prev, L(`hammad@portfolio:~$ ${cmd}`, "prompt")]);

    if (cmd === "clear") { setLines([]); return; }
    if (cmd === "help")  { addLines(HELP); return; }

    if (tailing) {
      if (cmd === "clear") { setLines([]); setTailing(false); tailRef.current?.disconnect(); return; }
      addLines([L('  press ctrl+c to stop streaming', "dim")]);
      return;
    }

    setBusy(true);

    try {
      // ── ping ────────────────────────────────────────────────────────────────
      if (cmd === "ping") {
        addLines([L(`  PING ${API}/health`, "dim")]);
        const t0 = Date.now();
        const res = await fetch(`${API}/health`);
        const ms = Date.now() - t0;
        const body = await res.json() as unknown;
        addLines([
          L(`  ${res.status} ${res.ok ? "OK" : "ERR"} · ${ms}ms`, res.ok ? "lime" : "err"),
          ...jsonLines(body),
          BLANK(),
        ]);
        return;
      }

      // ── tail ────────────────────────────────────────────────────────────────
      if (cmd === "tail") {
        setTailing(true);
        addLines([L("  streaming live requests — ctrl+c to stop", "dim"), BLANK()]);
        const socket = io(`${API}/metrics`, { path: "/socket.io" });
        tailRef.current = socket;
        socket.on("request", (e: RequestEvent) => {
          const method = e.method.padEnd(6);
          const path   = e.path.padEnd(36);
          const status = String(e.status);
          const ms     = `${e.ms}ms`;
          setLines((prev) => [
            ...prev.slice(-120),
            { id: _lid++, text: `  ${method} ${path} ${status}  ${ms}`, type: "out" },
          ]);
        });
        return; // leave busy=false below — tail runs indefinitely
      }

      // ── rag <query> ─────────────────────────────────────────────────────────
      if (cmd.startsWith("rag ")) {
        const q = cmd.slice(4).trim();
        if (!q) { addLines([L("  usage: rag <query>", "err"), BLANK()]); return; }

        addLines([L(`  embedding query...`, "dim")]);
        const t0 = Date.now();
        const res = await fetch(`${API}/chat/kb/search?q=${encodeURIComponent(q)}&limit=3`);
        const ms  = Date.now() - t0;

        if (!res.ok) { addLines([L(`  error ${res.status}`, "err"), BLANK()]); return; }
        const chunks = await res.json() as KBChunk[];

        if (chunks.length === 0) {
          addLines([L("  no results found in knowledge base", "dim"), BLANK()]);
          return;
        }

        const out: TermLine[] = [
          L(`  ${chunks.length} result${chunks.length > 1 ? "s" : ""} · pgvector cosine similarity · ${ms}ms`, "dim"),
          BLANK(),
        ];
        chunks.forEach((c, i) => {
          out.push(L(`  [${i + 1}/${chunks.length}] ${c.title}`, "amber"));
          // word-wrap excerpt at ~60 chars
          const words = c.excerpt.split(" ");
          let row = "        ";
          for (const w of words) {
            if ((row + w).length > 68) { out.push(L(row, "out")); row = "        " + w + " "; }
            else row += w + " ";
          }
          if (row.trim()) out.push(L(row, "out"));
          out.push(BLANK());
        });
        addLines(out);
        return;
      }

      // ── GET <path> ──────────────────────────────────────────────────────────
      if (cmd.startsWith("GET ")) {
        const path = cmd.slice(4).trim();
        addLines([L(`  GET ${API}${path}`, "dim")]);
        const t0  = Date.now();
        const res = await fetch(`${API}${path}`);
        const ms  = Date.now() - t0;
        const body = await res.json().catch(() => null) as unknown;
        addLines([
          L(`  ${res.status} ${res.statusText} · ${ms}ms`, res.ok ? "lime" : "err"),
          BLANK(),
          ...jsonLines(body),
          BLANK(),
        ]);
        return;
      }

      // ── unknown ─────────────────────────────────────────────────────────────
      addLines([L(`  unknown command: ${cmd.split(" ")[0]} — try "help"`, "err"), BLANK()]);

    } catch (e) {
      addLines([L(`  error: ${e instanceof Error ? e.message : "unknown"}`, "err"), BLANK()]);
    } finally {
      setBusy(false);
    }
  }, [API, addLines, tailing]);

  // ── Key handling ────────────────────────────────────────────────────────────

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+C — stop tail or clear input
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      if (tailing) stopTail();
      else setInput("");
      return;
    }

    if (e.key === "Enter" && !busy) {
      e.preventDefault();
      const v = input;
      setInput("");
      void run(v);
      return;
    }

    // History navigation
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? "" : (history[next] ?? ""));
      return;
    }

    // Tab autocomplete
    if (e.key === "Tab") {
      e.preventDefault();
      const v = input;
      if (!v) return;

      // Complete command prefix
      const prefix = CMD_PREFIXES.find((p) => p.startsWith(v) && p !== v);
      if (prefix) { setInput(prefix); return; }

      // Complete API path after GET
      const pathMatch = v.match(/^(GET )(\/.*)$/);
      if (pathMatch) {
        const verb = pathMatch[1] ?? "";
        const partial = pathMatch[2] ?? "";
        const match = COMMON_PATHS.find((p) => p.startsWith(partial) && p !== partial);
        if (match) setInput(verb + match);
      }
    }
  }, [busy, history, histIdx, input, run, tailing, stopTail]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="bg-ink-900 border border-ink-600 rounded-xl overflow-hidden cursor-text font-mono"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-line bg-ink-800">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-danger/70" />
          <span className="w-3 h-3 rounded-full bg-warn/70" />
          <span className="w-3 h-3 rounded-full bg-ok/70" />
        </div>
        <span className="ml-2 text-[10px] text-text-lo uppercase tracking-widest">
          portfolio — terminal
        </span>
        {tailing && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-signal">
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
            STREAMING
          </span>
        )}
      </div>

      {/* Scrollback */}
      <div className="h-80 overflow-y-auto p-5 space-y-px text-[12px] leading-relaxed">
        {lines.map((l) => (
          <div key={l.id}>
            {l.type === "blank" ? (
              <div className="h-2" />
            ) : l.type === "json" ? (
              <JsonLine text={l.text} />
            ) : (
              <span
                className="block whitespace-pre font-mono text-[11px] leading-relaxed"
                style={{
                  color:
                    l.type === "prompt" ? "#C6FF3A" :
                    l.type === "lime"   ? "#C6FF3A" :
                    l.type === "amber"  ? "#FFB020" :
                    l.type === "err"    ? "#F85149" :
                    l.type === "dim"    ? "#5C6573" :
                    "#99A2B2",
                }}
              >
                {l.text}
              </span>
            )}
          </div>
        ))}

        {/* Blinking cursor line */}
        <div className="flex items-center pt-1">
          <span className="text-signal text-[11px] shrink-0 select-none">
            hammad@portfolio:~$&nbsp;
          </span>
          <span className="text-[11px] text-text-hi whitespace-pre">{input}</span>
          <span className="inline-block w-[7px] h-[13px] bg-signal opacity-80 animate-pulse ml-px align-middle" />
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Hidden input — captures keystrokes */}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => !busy && setInput(e.target.value)}
        onKeyDown={onKeyDown}
        className="sr-only"
        aria-label="Terminal input"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={busy && !tailing}
      />
    </div>
  );
}
