"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { trackConversion, getSessionId } from "@/lib/analytics";
import { Conversation } from "@elevenlabs/client";

// ─── Chat types ───────────────────────────────────────────────────────────────
interface Source { id: string; title: string; }
interface ToolCall { name: string; args: { sectionId?: string; projectSlug?: string; postSlug?: string; prefillMessage?: string }; }
interface Message { role: "user" | "assistant"; content: string; sources?: Source[]; toolCalls?: ToolCall[]; }

const CHAT_PROMPTS = [
  "Is he open to remote work?",
  "What's his strongest project?",
  "How did he build the RAG chatbot?",
];


const CALL_PROMPTS = ["What stack do you use?", "Are you open to remote?", "Tell me about your AI work"];

const TEASER_PROMPTS = [
  "Is he open to remote work?",
  "What's his strongest project?",
  "How did he build this chatbot?",
  "What's his backend experience?",
];

type CallState = "idle" | "ringing" | "active" | "ended";
type ActivePanel = "chat" | "call" | null;

// ─── Tiny shared icons ────────────────────────────────────────────────────────
const ChatSVG = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="currentColor" />
  </svg>
);
const PhoneSVG = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12.1 19.79 19.79 0 0 1 1.61 3.5 2 2 0 0 1 3.6 1.32h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 15.28z" />
  </svg>
);
const CloseSVG = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const MicSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const MicOffSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const DiagramSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    <line x1="10" y1="6.5" x2="14" y2="6.5"/><line x1="10" y1="17.5" x2="14" y2="17.5"/><line x1="6.5" y1="10" x2="6.5" y2="14"/><line x1="17.5" y1="10" x2="17.5" y2="14"/>
  </svg>
);


// ─── Nav section labels ────────────────────────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
  skills: "Skills", experience: "Experience", projects: "Projects",
  "case-studies": "Case Studies", contact: "Contact", blog: "Writing",
  availability: "Availability",
};
function slugToTitle(slug: string) {
  return slug.split("-").slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ─── Module-level constants ────────────────────────────────────────────────────
const PROFANITY_LIST = ["fuck", "shit", "bitch", "cunt", "asshole", "bastard", "dick", "cock", "pussy", "nigger", "faggot"];
export const hasProfanity = (t: string) => PROFANITY_LIST.some(w => t.toLowerCase().includes(w));

// ─── Sub-components ───────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "embed",   label: "vector embedding",      ms: 480  },
  { key: "search",  label: "searching knowledge base", ms: 720  },
  { key: "rank",    label: "ranking context",        ms: 400  },
  { key: "compose", label: "composing response",     ms: Infinity },
] as const;

function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 32);
    return () => clearInterval(id);
  }, []);

  // Compute active stage index and progress within it from elapsed time
  let rem = elapsed;
  let activeIdx = PIPELINE_STAGES.length - 1;
  for (let i = 0; i < PIPELINE_STAGES.length - 1; i++) {
    const stage = PIPELINE_STAGES[i];
    if (!stage) break;
    const dur = stage.ms as number;
    if (rem < dur) { activeIdx = i; break; }
    rem -= dur;
  }
  const activeProgress = (() => {
    const dur = (PIPELINE_STAGES[activeIdx]?.ms) as number;
    if (!isFinite(dur)) return -1; // infinite — pulse animation
    return Math.min(rem / dur, 0.95);
  })();

  return (
    <div className="flex items-start" aria-label="Processing">
      <div className="bg-ink-800 border border-ink-600 rounded-xl rounded-bl-sm px-3.5 py-3 min-w-[210px]" style={{ animation: "sdMsgIn 0.18s ease-out" }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-ink-600">
          <span className="w-1.5 h-1.5 rounded-full bg-signal" style={{ animation: "sdBlink 1.2s step-end infinite" }} />
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-lo">rag pipeline</span>
        </div>

        {/* Stages */}
        <div className="space-y-1.5">
          {PIPELINE_STAGES.map((stage, i) => {
            const done    = i < activeIdx;
            const active  = i === activeIdx;
            const pending = i > activeIdx;
            const prog    = done ? 1 : active ? (activeProgress < 0 ? 0.6 : activeProgress) : 0;

            return (
              <div key={stage.key} className="flex items-center gap-2">
                {/* Status icon */}
                <span className="w-3 text-center flex-shrink-0 font-mono text-[10px]" style={{
                  color: done ? "var(--ok)" : active ? "var(--signal)" : "var(--text-lo)",
                  opacity: pending ? 0.35 : 1,
                }}>
                  {done ? "✓" : active ? "◈" : "○"}
                </span>

                {/* Label */}
                <span className="font-mono text-[10px] tracking-wide flex-1 truncate" style={{
                  color: done ? "var(--text-lo)" : active ? "var(--text-hi)" : "var(--text-lo)",
                  opacity: pending ? 0.35 : 1,
                }}>
                  {stage.label}
                </span>

                {/* Progress bar */}
                <div className="w-10 h-[2px] rounded-full flex-shrink-0" style={{ background: "var(--ink-600)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${Math.round(prog * 100)}%`,
                    background: done ? "var(--ok)" : "var(--signal)",
                    opacity: pending ? 0 : 1,
                    transition: active ? "width 0.08s linear" : "none",
                    ...(active && activeProgress < 0 ? { animation: "sdPulseBar 1.4s ease-in-out infinite" } : {}),
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function renderMarkdown(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  text.split("\n").forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) { if (nodes.length) nodes.push(<div key={`g${i}`} style={{ height: "4px" }} />); return; }
    if (line.startsWith("### ") || line.startsWith("## ")) {
      nodes.push(<div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--text-lo)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: nodes.length ? "10px" : 0, marginBottom: "2px" }}>{line.replace(/^#{2,3}\s/, "").replace(/:$/, "")}</div>);
      return;
    }
    if (/^[–\-]\s/.test(line)) {
      nodes.push(<div key={i} style={{ display: "flex", gap: "6px", marginTop: "2px" }}><span style={{ color: "var(--signal)", flexShrink: 0 }}>–</span><span>{renderInline(line.replace(/^[–\-]\s/, ""))}</span></div>);
      return;
    }
    nodes.push(<div key={i}>{renderInline(line)}</div>);
  });
  return <>{nodes}</>;
}

function NavChips({ toolCalls, onNavigate }: { toolCalls: ToolCall[]; onNavigate: (tc: ToolCall) => void }) {
  if (!toolCalls.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {toolCalls.slice(0, 3).map((tc, i) => {
        const label = tc.name === "navigateToSection"
          ? (SECTION_LABELS[tc.args.sectionId ?? ""] ?? tc.args.sectionId ?? "Section")
          : tc.name === "openProject" ? slugToTitle(tc.args.projectSlug ?? "")
          : tc.name === "openBlogPost" ? slugToTitle(tc.args.postSlug ?? "")
          : tc.name === "openContactForm" ? "Contact Hammad"
          : tc.name;
        return (
          <button key={i} onClick={() => onNavigate(tc)}
            className="inline-flex items-center gap-2 bg-ink-800 border border-ink-600 rounded-full px-4 py-1.5 font-mono text-mono-label text-text-mid hover:border-signal hover:text-signal transition-colors">
            {label}<span className="text-signal">→</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Sound wave (AI speaking) ─────────────────────────────────────────────────
function SoundWave() {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {[0.6, 1, 1.4, 1, 0.6, 1.2, 0.8].map((delay, i) => (
        <span key={i} className="w-[3px] rounded-full bg-signal"
          style={{ height: `${10 + i % 3 * 6}px`, animation: `sdWave 0.8s ease-in-out infinite`, animationDelay: `${delay * 0.15}s` }} />
      ))}
    </div>
  );
}

// ─── Mic pulse (user speaking / listening) ────────────────────────────────────
function MicPulse() {
  return (
    <div className="relative flex items-center justify-center w-8 h-8">
      <span className="absolute inset-0 rounded-full border border-text-lo animate-ping opacity-30" />
      <MicSVG />
    </div>
  );
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const PUBLIC_API = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
  : "http://localhost:3001";

// ─── Main SpeedDial component ─────────────────────────────────────────────────
export default function SpeedDial() {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Track keyboard height via visualViewport so the bottom sheet floats above the keyboard on mobile
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop ?? 0));
      setKeyboardOffset(offset);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

  // Feature flags — fetched once on mount, fail open so a network error never hides the widget
  const [featFlags, setFeatFlags] = useState({ chat: true, voice: true });
  useEffect(() => {
    void Promise.all([
      fetch(`${PUBLIC_API}/content/site/feature_chatbot_enabled`).then((r) => r.ok ? r.json() as Promise<{ enabled: boolean } | null> : null).catch(() => null),
      fetch(`${PUBLIC_API}/content/site/feature_voice_enabled`).then((r) => r.ok ? r.json() as Promise<{ enabled: boolean } | null> : null).catch(() => null),
    ]).then(([chat, voice]) => {
      setFeatFlags({
        chat:  chat  == null ? true : (chat  as { enabled: boolean }).enabled !== false,
        voice: voice == null ? true : (voice as { enabled: boolean }).enabled !== false,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]);
  // Prevents concurrent sends — stays true from SSE connect through read-loop end.
  const isStreamingRef = useRef(false);
  // Stores the tool call received during streaming so auto-nav can fire on done event.
  const pendingNavRef = useRef<ToolCall | null>(null);
  // Typewriter: full received buffer + displayed content state
  const streamBufRef = useRef("");
  const [typewriterText, setTypewriterText] = useState("");
  const twRafRef = useRef<number | null>(null);

  // Call state
  const [callState, setCallState] = useState<CallState>("idle");
  const [callError, setCallError] = useState<string | null>(null);
  const [callMode, setCallMode] = useState<"listening" | "speaking" | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<Array<{ role: "user" | "agent"; message: string }>>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showDiagram, setShowDiagram] = useState<{ slug: string; url: string } | null>(null);
  const [showBlogCard, setShowBlogCard] = useState<{ slug: string; title: string } | null>(null);
  const [showProjectCard, setShowProjectCard] = useState<{ slug: string; title: string } | null>(null);
  const [showVisitorToast, setShowVisitorToast] = useState<{ count: number } | null>(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const liveTranscriptEndRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const voiceConversationIdRef = useRef<string | null>(null);
  const transcriptTurnsRef = useRef<Array<{ role: "user" | "agent"; message: string }>>([]);

  // Teaser callout state
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [teaserIdx, setTeaserIdx] = useState(0);
  const [teaserCycle, setTeaserCycle] = useState(0);
  // Initialise from sessionStorage so dismissal persists across page navigations
  const [chatOpened, setChatOpened] = useState(() => {
    try { return sessionStorage.getItem("sd_teaser_closed") === "1"; } catch { return false; }
  });
  const teaserAutoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teaserRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Teaser callout — max 2 cycles per session, longer delay on mobile ───────
  const dismissTeaser = useCallback(() => {
    setTeaserVisible(false);
    if (teaserAutoRef.current)   clearTimeout(teaserAutoRef.current);
    if (teaserRotateRef.current) clearInterval(teaserRotateRef.current);
    try { sessionStorage.setItem("sd_teaser_closed", "1"); } catch { /* ignore */ }
    setChatOpened(true);
  }, []);

  useEffect(() => {
    // Stop after 2 cycles or if already dismissed this session
    if (chatOpened || teaserCycle >= 2) return;
    const isMobileVp = typeof window !== "undefined" && window.innerWidth < 768;
    // Longer initial delay on mobile (content is tighter); subsequent cycle: 2 min
    const delay = teaserCycle === 0 ? (isMobileVp ? 10000 : 4000) : 120000;
    const show = setTimeout(() => {
      setTeaserVisible(true);
      teaserRotateRef.current = setInterval(
        () => setTeaserIdx(p => (p + 1) % TEASER_PROMPTS.length),
        4000,
      );
      // Auto-dismiss after 10s, then schedule next cycle
      teaserAutoRef.current = setTimeout(() => {
        setTeaserVisible(false);
        if (teaserRotateRef.current) clearInterval(teaserRotateRef.current);
        setTeaserCycle(c => c + 1);
      }, 10000);
    }, delay);
    return () => {
      clearTimeout(show);
      if (teaserAutoRef.current)   clearTimeout(teaserAutoRef.current);
      if (teaserRotateRef.current) clearInterval(teaserRotateRef.current);
    };
  }, [teaserCycle, chatOpened]);

  // Stop teaser cycle when chat is opened; persist to sessionStorage
  useEffect(() => {
    if (activePanel === "chat") {
      setChatOpened(true);
      try { sessionStorage.setItem("sd_teaser_closed", "1"); } catch { /* ignore */ }
      if (teaserVisible) {
        setTeaserVisible(false);
        if (teaserAutoRef.current)   clearTimeout(teaserAutoRef.current);
        if (teaserRotateRef.current) clearInterval(teaserRotateRef.current);
      }
    }
  }, [activePanel, teaserVisible]);

  // Listen for programmatic open-chat events (from ⌘K palette)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prefill?: { question: string; answer: string; sources: Source[] } }>).detail;
      if (detail?.prefill) {
        setMessages([
          { role: "user",      content: detail.prefill.question },
          { role: "assistant", content: detail.prefill.answer, sources: detail.prefill.sources, toolCalls: [] },
        ]);
      }
      setActivePanel("chat");
    };
    window.addEventListener("open-chat", handler);
    return () => window.removeEventListener("open-chat", handler);
  }, []);

  // Call duration timer + 5-min client-side hard limit
  const CALL_MAX_SECONDS = 300;
  const CALL_WARN_SECONDS = 240;
  useEffect(() => {
    if (callState !== "active") { setCallDuration(0); return; }
    const t = setInterval(() => {
      setCallDuration(d => {
        const next = d + 1;
        if (next >= CALL_MAX_SECONDS) {
          void conversationRef.current?.endSession();
          conversationRef.current = null;
          setCallState("ended");
          setCallMode(null);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [callState]);

  // Auto-scroll live transcript
  useEffect(() => {
    liveTranscriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveTranscript]);

  // Scroll chat to bottom
  useEffect(() => {
    if (activePanel === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, activePanel]);

  // Focus input when chat panel opens
  useEffect(() => {
    if (activePanel === "chat") {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [activePanel]);

  const openPanel = (panel: ActivePanel) => {
    setActivePanel(panel);
    if (panel === "chat") trackConversion("chatbot_open");
    if (panel === "call") trackConversion("call_open");
  };

  const closePanel = () => {
    setActivePanel(null);
    if (callState === "active" || callState === "ringing") {
      // endSession triggers onDisconnect which posts the transcript
      void conversationRef.current?.endSession();
      conversationRef.current = null;
      setCallState("idle");
    }
  };

  // Keep messagesRef in sync to avoid stale closures in sendMessage
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Navigation is now server-driven: auto-nav fires only when the server emits
  // navigationOnly:true in the done event. Mixed responses (answer + chip) never
  // auto-navigate — the user clicks the chip when they're ready.

  // ── Chat actions ─────────────────────────────────────────────────────────────
  const ESCALATION_TRIGGERS = ["i don't have that info", "don't have that info", "ask hammad directly"];
  const isEscalation = (t: string) => ESCALATION_TRIGGERS.some(k => t.toLowerCase().includes(k));

const sendMessage = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query || isLoading || isStreamingRef.current) return;

    if (hasProfanity(query)) {
      setMessages(prev => [
        ...prev,
        { role: "user", content: query },
        { role: "assistant", content: "Let's keep it professional. Ask me anything about Hammad's work, skills, or projects.", sources: [], toolCalls: [] },
      ]);
      setInput("");
      return;
    }

    if (query.length < 3) {
      setMessages(prev => [
        ...prev,
        { role: "user", content: query },
        { role: "assistant", content: "Could you elaborate? I'm here to answer questions about Hammad's background and projects.", sources: [], toolCalls: [] },
      ]);
      setInput("");
      return;
    }
    const history = messagesRef.current.slice(-6).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: "user", content: query }]);
    trackConversion("chatbot_query", { query });
    setInput("");
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    pendingNavRef.current = null;
    setIsLoading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const body = JSON.stringify({ query, sessionId: getSessionId(), history });

    // Try SSE streaming first
    let sseStarted = false;
    const setErrorOnPlaceholder = () => setMessages(prev => {
      const msgs = [...prev];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant" && !last.content) msgs[msgs.length - 1] = { ...last, content: "Something went wrong. Try again." };
      return msgs;
    });

    try {
      const res = await fetch(`${apiUrl}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok || !res.body) throw new Error(`no stream: ${res.status}`);

      sseStarted = true;
      isStreamingRef.current = true;
      setIsStreaming(true);
      streamBufRef.current = "";
      setTypewriterText("");
      if (twRafRef.current) { cancelAnimationFrame(twRafRef.current); twRafRef.current = null; }
      setMessages(prev => [...prev, { role: "assistant", content: "", sources: [], toolCalls: [] }]);
      setIsLoading(false);

      // Typewriter RAF loop — drains streamBufRef at ~4 chars/frame (~240 chars/sec)
      const tickTypewriter = () => {
        setTypewriterText(prev => {
          const buf = streamBufRef.current;
          if (prev.length >= buf.length) { twRafRef.current = null; return prev; }
          const next = buf.slice(0, Math.min(prev.length + 4, buf.length));
          twRafRef.current = requestAnimationFrame(tickTypewriter);
          return next;
        });
      };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(part.slice(6)) as { token?: string; sources?: Source[]; toolCalls?: ToolCall[]; done?: boolean; error?: boolean; navigationOnly?: boolean };
            if (evt.token) {
              streamBufRef.current += evt.token;
              if (!twRafRef.current) twRafRef.current = requestAnimationFrame(tickTypewriter);
            }
            if (evt.sources) {
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, sources: evt.sources ?? [] };
                return msgs;
              });
            }
            if (evt.toolCalls && evt.toolCalls.length > 0) {
              // Store first tool call for potential auto-nav (navigationOnly path)
              pendingNavRef.current = evt.toolCalls[0] ?? null;
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, toolCalls: evt.toolCalls ?? [] };
                return msgs;
              });
            }
            if (evt.done) {
              // Server confirmed this was a pure navigation request — fire immediately.
              // All other responses with chips are click-only; never auto-navigate.
              if (evt.navigationOnly && pendingNavRef.current) {
                const tc = pendingNavRef.current;
                setTimeout(() => {
                  if (tc.name === "navigateToSection" && tc.args.sectionId) {
                    if (tc.args.sectionId === "blog") {
                      void router.push("/blog");
                    } else {
                      const el = document.getElementById(tc.args.sectionId);
                      if (el) { el.scrollIntoView({ behavior: "smooth" }); }
                      else { void router.push("/#" + tc.args.sectionId); }
                    }
                  } else if (tc.name === "openProject" && tc.args.projectSlug) {
                    void router.push("/projects/" + tc.args.projectSlug);
                  } else if (tc.name === "openBlogPost" && tc.args.postSlug) {
                    void router.push("/blog/" + tc.args.postSlug);
                  }
                  pendingNavRef.current = null;
                }, 400);
              }
              break outer;
            }
            if (evt.error) {
              console.warn("[chat] SSE error event");
              setErrorOnPlaceholder();
              setIsLoading(false);
              return;
            }
          } catch (e) { console.warn("[chat] SSE parse err:", e); }
        }
      }
      // SSE stream ended — flush typewriter buffer into messages
      if (twRafRef.current) { cancelAnimationFrame(twRafRef.current); twRafRef.current = null; }
      const finalContent = streamBufRef.current || "I don't have that info — ask Hammad directly";
      setTypewriterText(finalContent);
      isStreamingRef.current = false;
      setIsStreaming(false);
      setMessages(prev => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: finalContent };
        return msgs;
      });
      return;
    } catch (e) {
      console.warn("[chat] SSE failed:", e);
      if (sseStarted) {
        isStreamingRef.current = false;
        setIsStreaming(false);
        setErrorOnPlaceholder();
        setIsLoading(false);
        return;
      }
    }

    // Fallback: regular fetch (only runs if SSE never connected)
    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { answer: string; sources: Source[]; toolCalls?: ToolCall[] };
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources ?? [], toolCalls: data.toolCalls ?? [] }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again.", sources: [] }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  function handleNavChip(tc: ToolCall) {
    setTimeout(() => {
      if (tc.name === "navigateToSection" && tc.args.sectionId) {
        if (tc.args.sectionId === "blog") {
          void router.push("/blog");
        } else {
          const el = document.getElementById(tc.args.sectionId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth" });
          } else {
            void router.push("/#" + tc.args.sectionId);
          }
        }
      } else if (tc.name === "openProject" && tc.args.projectSlug) {
        // Open in new tab so the chat conversation stays open
        window.open("/projects/" + tc.args.projectSlug, "_blank", "noopener");
      } else if (tc.name === "openBlogPost" && tc.args.postSlug) {
        // Open in new tab so the chat conversation stays open
        window.open("/blog/" + tc.args.postSlug, "_blank", "noopener");
      } else if (tc.name === "openContactForm") {
        if (tc.args.prefillMessage) {
          window.dispatchEvent(new CustomEvent("prefill-contact", { detail: { message: tc.args.prefillMessage } }));
        }
        const el = document.getElementById("contact");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        } else {
          void router.push("/#contact");
        }
      }
    }, 80);
  }

  // ── Call actions ─────────────────────────────────────────────────────────────

  // Fetch an HMAC token from the server immediately after ElevenLabs gives us the
  // conversationId. Stored in a ref so postTranscript can include it.
  const transcriptTokenRef = useRef<string>("");

  const fetchTranscriptToken = async (conversationId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    try {
      const res = await fetch(`${apiUrl}/chat/transcript-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (res.ok) {
        const data = await res.json() as { token: string };
        transcriptTokenRef.current = data.token;
      }
    } catch { /* non-fatal — transcript POST will fail gracefully without token */ }
  };

  const postTranscript = async (conversationId: string) => {
    const turns = transcriptTurnsRef.current;
    if (!conversationId || turns.length === 0) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    await fetch(`${apiUrl}/chat/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, turns, token: transcriptTokenRef.current }),
    }).catch(() => {});
  };

  const handleCallStart = async (openingTopic?: string) => {
    // Mic permission pre-flight
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      setCallError("Microphone access denied. Allow mic in your browser settings to use voice call.");
      return;
    }

    setCallState("ringing");
    setCallError(null);
    setLiveTranscript([]);
    setIsMuted(false);
    setCallMinimized(false);
    transcriptTurnsRef.current = [];
    transcriptTokenRef.current = "";
    voiceConversationIdRef.current = null;

    try {
      const tokenRes = await fetch("/api/voice-token", { method: "POST" });
      const tokenData = await tokenRes.json() as { signedUrl?: string; error?: string };
      if (!tokenData.signedUrl) throw new Error(tokenData.error ?? "Voice agent not configured");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

      const conv = await Conversation.startSession({
        signedUrl: tokenData.signedUrl,
        ...(openingTopic ? { overrides: { agent: { firstMessage: `Hi! I'm Hammad's AI. You wanted to know about "${openingTopic}" — let me address that right away. What specifically would you like to know?` } } } : {}),

        onConnect: ({ conversationId }: { conversationId: string }) => {
          voiceConversationIdRef.current = conversationId;
          void fetchTranscriptToken(conversationId);
          setCallState("active");
          setCallMode("listening");
        },

        onModeChange: ({ mode }: { mode: "listening" | "speaking" }) => {
          setCallMode(mode);
        },

        onMessage: ({ message, role }: { message: string; role: "user" | "agent" }) => {
          transcriptTurnsRef.current.push({ role, message });
          setLiveTranscript(prev => [...prev, { role, message }]);
        },

        onDisconnect: () => {
          const cid = voiceConversationIdRef.current;
          if (cid) void postTranscript(cid);
          conversationRef.current = null;
          setCallMode(null);
          setCallState("ended");
          setCallMinimized(false); // always show ended summary
        },

        onError: (msg: string) => {
          setCallError(typeof msg === "string" ? msg : "Voice call error. Please try again.");
          setCallState("idle");
          conversationRef.current = null;
          setCallMode(null);
        },

        // ── Client tools — each dispatches a CustomEvent the portfolio listens to ──
        clientTools: {
          navigate_to_section: ({ section_id }: { section_id: string }) => {
            if (section_id === "blog") {
              window.open("/blog", "_blank", "noopener");
            } else {
              const el = document.getElementById(section_id);
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
              } else {
                // Element not in DOM — open homepage anchor in new tab to preserve call
                window.open("/#" + section_id, "_blank", "noopener");
              }
            }
            return `Navigated to ${section_id}`;
          },

          highlight_skill: ({ skill_name }: { skill_name: string }) => {
            window.dispatchEvent(new CustomEvent("highlight-skill", { detail: { skill: skill_name } }));
            return `Highlighted ${skill_name}`;
          },

          open_project: ({ slug }: { slug: string }) => {
            const title = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            setShowProjectCard({ slug, title });
            setCallMinimized(true);
            setTimeout(() => setShowProjectCard(null), 12000);
            return `Showing project card for ${slug}`;
          },

          show_architecture_diagram: async ({ project_slug, diagram_url }: { project_slug: string; diagram_url?: string }) => {
            let url = diagram_url;
            if (!url) {
              try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
                const res = await fetch(`${apiUrl}/content/projects/${project_slug}`);
                if (res.ok) {
                  const project = await res.json() as { diagramImageUrl?: string | null; architectureDiagram?: string | null };
                  url = project.diagramImageUrl ?? undefined;
                }
              } catch { /* non-fatal */ }
            }
            if (url) {
              setShowDiagram({ slug: project_slug, url });
              setCallMinimized(true);
              return `Showing architecture diagram for ${project_slug}`;
            }
            return `No architecture diagram stored for ${project_slug}`;
          },

          open_contact_form: ({ prefill_message }: { prefill_message?: string }) => {
            if (prefill_message) {
              window.dispatchEvent(new CustomEvent("prefill-contact", { detail: { message: prefill_message } }));
            }
            const el = document.getElementById("contact");
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
            } else {
              window.open("/#contact", "_blank", "noopener");
            }
            return "Contact form opened";
          },

          show_live_visitors: async () => {
            try {
              const res = await fetch(`${apiUrl}/analytics/metrics`);
              if (!res.ok) throw new Error("fetch failed");
              const data = await res.json() as { visitorsOnline?: number };
              const count = data.visitorsOnline ?? 1;
              setShowVisitorToast({ count });
              setCallMinimized(true);
              setTimeout(() => setShowVisitorToast(null), 6000);
              return `There are ${count} people viewing this portfolio right now`;
            } catch {
              return "Unable to fetch visitor count at this moment";
            }
          },

          suggest_blog_post: ({ slug, title }: { slug: string; title: string }) => {
            setShowBlogCard({ slug, title });
            setCallMinimized(true);
            setTimeout(() => setShowBlogCard(null), 10000);
            return `Suggested blog post: ${title}`;
          },

          show_availability: () => {
            document.getElementById("availability")?.scrollIntoView({ behavior: "smooth" });
            return "Scrolled to availability section";
          },

          mute_self: () => {
            const next = !isMuted;
            setIsMuted(next);
            conversationRef.current?.setMicMuted(next);
            return next ? "Muted microphone" : "Unmuted microphone";
          },
        },
      });

      conversationRef.current = conv;
      trackConversion("voice_call_start");
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Failed to start voice call");
      setCallState("idle");
    }
  };

  const handleCallEnd = async () => {
    await conversationRef.current?.endSession();
    conversationRef.current = null;
    setCallMode(null);
    setCallState("ended");
  };

  // ── Panel position (always bottom-6 right-4, panel floats above FAB) ─────────
  const PANEL_BOTTOM = "bottom-[5.5rem]";
  const FAB_BOTTOM = "bottom-5 right-3";

  // Show ThinkingIndicator only while waiting for the first token.
  // During streaming, displayed text lives in typewriterText (not messages[last].content),
  // so we gate on typewriterText being empty rather than the message content field.
  const isThinking = isLoading || (isStreaming && typewriterText.length === 0);

  return (
    <>
      <style>{`
        @keyframes sdDotBounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-4px);opacity:1} }
        @keyframes sdWave      { 0%,100%{transform:scaleY(0.5);opacity:.6} 50%{transform:scaleY(1.2);opacity:1} }
        @keyframes sdPanelIn   { from{opacity:0;transform:translateY(10px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes sdBlink     { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes sdMsgIn     { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sdPulseBar  { 0%,100%{width:45%;opacity:.7} 50%{width:75%;opacity:1} }
      `}</style>

      {/* ── Mobile backdrop ── */}
      {activePanel && (
        <div
          className="fixed inset-0 z-[299] bg-ink-900/60 sm:hidden"
          onClick={closePanel}
          aria-hidden="true"
        />
      )}

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {activePanel === "chat" && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            role="dialog" aria-label="Portfolio chatbot" aria-modal="true"
            className="fixed z-[300] left-0 right-0 bottom-0 rounded-t-[20px] max-h-[88dvh] sm:left-auto sm:right-3 sm:bottom-[5.5rem] sm:w-[min(440px,calc(100vw-3.5rem))] sm:max-h-[70vh] sm:rounded-xl bg-ink-800 border border-ink-600 flex flex-col overflow-hidden shadow-[0_-4px_32px_rgba(0,0,0,.5)] sm:shadow-[0_8px_48px_rgba(0,0,0,.6)]"
            style={keyboardOffset > 0 ? { bottom: keyboardOffset } : {}}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-2.5 pb-0 sm:hidden">
              <div className="w-9 h-1 rounded-full bg-ink-600" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-signal" style={{ animation: "sdDotBounce 2s ease-in-out infinite" }} />
                <span className="font-mono text-mono-label text-text-hi tracking-widest">ASK MY PORTFOLIO</span>
              </div>
              <button onClick={closePanel} aria-label="Close chat" className="text-text-lo hover:text-text-hi transition-colors p-1">
                <CloseSVG />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0" aria-live="polite">
              {messages.length === 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-text-mid leading-relaxed">Hi — I can answer questions about Hammad&apos;s background, projects, and availability. Try one of these:</p>
                  <div className="flex flex-col gap-1.5">
                    {CHAT_PROMPTS.map(p => (
                      <button key={p} onClick={() => void sendMessage(p)}
                        className="text-left bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-sm text-text-mid hover:border-signal hover:text-text-hi transition-colors">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const isLast = i === messages.length - 1;
                // During streaming, show the typewriter-animated text for the last assistant message
                const displayContent = (!isUser && isLast && isStreaming) ? typewriterText : msg.content;
                const isErr = !isUser && displayContent === "Something went wrong. Try again.";
                // Hide the empty assistant placeholder — ThinkingIndicator covers this gap
                if (!isUser && !displayContent && isStreaming) return null;
                if (!isUser && !msg.content && !isStreaming) return null;
                return (
                  <div key={i} style={{ animation: "sdMsgIn 0.18s ease-out" }} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                      isUser ? "bg-ink-700 border border-signal/20 text-text-hi rounded-br-sm"
                      : isErr ? "bg-danger/10 text-danger border border-danger/30 rounded-bl-sm"
                      : "bg-ink-700 border border-ink-600 text-text-hi rounded-bl-sm"
                    }`}>{displayContent ? renderMarkdown(displayContent) : null}</div>
                    {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && <NavChips toolCalls={msg.toolCalls} onNavigate={handleNavChip} />}
                    {!isUser && i === messages.length - 1 && isEscalation(msg.content) && !isLoading && (
                      <div className="mt-2 p-2.5 rounded-lg border border-ink-600 bg-ink-900">
                        <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mb-1.5">Reach Hammad directly</p>
                        <div className="flex gap-2">
                          <a href="#contact"
                            className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded border border-signal/50 text-signal hover:bg-signal/10 transition-colors">
                            Email →
                          </a>
                          <a href="#contact" onClick={(e) => { e.preventDefault(); closePanel(); setTimeout(() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }), 80); }}
                            className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded border border-ink-600 text-text-hi hover:border-text-lo transition-colors">
                            Contact
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {isThinking && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); void sendMessage(input); }}
              className="flex gap-2 p-3 border-t border-ink-600 flex-shrink-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
                }}
                placeholder="Ask a question…"
                disabled={isLoading || isThinking || isStreaming}
                aria-label="Chat message"
                rows={1}
                className="flex-1 bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-sm text-text-hi placeholder-text-lo outline-none focus:border-signal transition-colors resize-none overflow-hidden"
              />
              <button type="submit" disabled={isLoading || isThinking || isStreaming || !input.trim()} aria-label="Send"
                className="flex-shrink-0 self-end bg-signal text-signal-ink font-mono text-mono-label px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-signal-dim active:scale-[.97] transition-all">
                SEND
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Call minimized pill (shown when a content tool fires during active call) ── */}
      <AnimatePresence>
        {activePanel === "call" && callState === "active" && callMinimized && (
          <motion.div
            key="call-mini"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="fixed z-[300] right-3 bottom-[5.5rem] flex items-center gap-2.5 bg-ink-800 border border-signal/40 rounded-full px-3.5 py-2 shadow-[0_4px_24px_rgba(0,0,0,.6)] cursor-pointer select-none"
            onClick={() => setCallMinimized(false)}
            role="button"
            aria-label="Expand call panel"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse flex-shrink-0" />
            <span className="font-mono text-[10px] text-text-hi uppercase tracking-widest">
              {callMode === "speaking" ? "AI Speaking" : "Listening"}
            </span>
            <span className="font-mono text-[10px] text-text-lo tabular-nums">{formatDuration(callDuration)}</span>
            <div className="flex items-center gap-1.5 ml-1">
              <button
                aria-label={isMuted ? "Unmute" : "Mute"}
                onClick={e => {
                  e.stopPropagation();
                  const next = !isMuted;
                  setIsMuted(next);
                  conversationRef.current?.setMicMuted(next);
                }}
                className={`p-1 rounded-full transition-colors ${isMuted ? "text-warn" : "text-text-lo hover:text-text-hi"}`}
              >
                {isMuted ? <MicOffSVG /> : <MicSVG />}
              </button>
              <button
                aria-label="End call"
                onClick={e => { e.stopPropagation(); void handleCallEnd(); }}
                className="p-1 rounded-full text-danger hover:text-danger/80 transition-colors"
              >
                <PhoneSVG size={12} />
              </button>
            </div>
            <span className="font-mono text-[9px] text-text-lo uppercase tracking-widest opacity-60">tap to expand</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Call panel ── */}
      <AnimatePresence>
        {activePanel === "call" && !callMinimized && (
          <motion.div
            key="call-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[300] left-0 right-0 bottom-0 rounded-t-[20px] sm:left-auto sm:right-3 sm:bottom-[5.5rem] sm:w-[min(340px,calc(100vw-3.5rem))] sm:rounded-xl bg-ink-800 border border-ink-600 overflow-hidden shadow-[0_-4px_32px_rgba(0,0,0,.5)] sm:shadow-[0_8px_48px_rgba(0,0,0,.6)]"
            style={keyboardOffset > 0 ? { bottom: keyboardOffset } : {}}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-2.5 pb-0 sm:hidden">
              <div className="w-9 h-1 rounded-full bg-ink-600" />
            </div>
            {/* Header — identity always visible */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-600">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-signal flex items-center justify-center text-signal-ink font-mono font-bold text-[10px] flex-shrink-0">HA</div>
                <div>
                  <p className="font-mono text-[11px] font-bold text-text-hi tracking-wide leading-none">Hammad&apos;s AI</p>
                  <p className="font-mono text-[9px] text-text-lo uppercase tracking-widest leading-none mt-0.5">Voice Agent · ElevenLabs</p>
                </div>
                {callState === "active" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse ml-1" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {callState === "active" && (
                  <div className="flex items-center gap-1.5">
                    {callDuration >= CALL_WARN_SECONDS && (
                      <span className="font-mono text-[9px] text-warn uppercase tracking-widest animate-pulse">
                        {formatDuration(CALL_MAX_SECONDS - callDuration)} left
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-text-lo tabular-nums">{formatDuration(callDuration)}</span>
                  </div>
                )}
                <button onClick={closePanel} aria-label="Close call" className="text-text-lo hover:text-text-hi transition-colors p-1">
                  <CloseSVG />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-4">

              {/* ── IDLE ── */}
              {callState === "idle" && (
                <>
                  <p className="text-sm text-text-mid leading-relaxed">
                    Talk to an AI that knows everything about Hammad&apos;s work — architecture decisions, projects, availability, and more.
                  </p>
                  {/* Clickable suggestion chips — clicking starts the call primed on that topic */}
                  <div className="flex flex-col gap-2">
                    <p className="font-mono text-[9px] text-text-lo uppercase tracking-widest">Try asking:</p>
                    {CALL_PROMPTS.map(q => (
                      <button key={q} onClick={() => void handleCallStart(q)}
                        className="text-left px-3 py-2 bg-ink-700 border border-ink-600 rounded-lg text-sm text-text-mid hover:border-signal hover:text-text-hi transition-colors group">
                        <span className="text-signal opacity-60 group-hover:opacity-100 mr-1.5 transition-opacity">&ldquo;</span>{q}<span className="text-signal opacity-60 group-hover:opacity-100 ml-0.5 transition-opacity">&rdquo;</span>
                      </button>
                    ))}
                  </div>
                  {callError && (
                    <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
                      <span className="text-danger text-xs mt-0.5 flex-shrink-0">●</span>
                      <p className="text-xs font-mono text-danger leading-relaxed">{callError}</p>
                    </div>
                  )}
                  <button onClick={() => void handleCallStart()}
                    className="w-full flex items-center justify-center gap-2.5 bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest py-3 rounded-lg hover:bg-signal-dim active:scale-[.98] transition-all">
                    <PhoneSVG size={16} />
                    Start Call
                  </button>
                </>
              )}

              {/* ── RINGING ── */}
              {callState === "ringing" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <span className="absolute inset-0 rounded-full border-2 border-signal animate-ping opacity-40" />
                    <span className="absolute inset-1 rounded-full border border-signal opacity-20 animate-ping" style={{ animationDelay: "0.3s" }} />
                    <span className="w-14 h-14 rounded-full bg-signal flex items-center justify-center text-signal-ink">
                      <PhoneSVG size={22} />
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-mono-label text-text-hi uppercase tracking-widest">Connecting</p>
                    <p className="font-mono text-[10px] text-text-lo mt-1">Checking microphone + linking to ElevenLabs…</p>
                  </div>
                </div>
              )}

              {/* ── ACTIVE ── */}
              {callState === "active" && (
                <div className="flex flex-col gap-3">
                  {/* Mode indicator */}
                  <div className="flex flex-col items-center gap-1.5 py-2">
                    {callMode === "speaking" ? (
                      <>
                        <SoundWave />
                        <p className="font-mono text-[10px] text-signal uppercase tracking-widest">● AI Speaking</p>
                      </>
                    ) : (
                      <>
                        <MicPulse />
                        <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest">Listening…</p>
                      </>
                    )}
                  </div>

                  {/* Live transcript */}
                  {liveTranscript.length > 0 && (
                    <div className="bg-ink-900 rounded-lg p-2.5 max-h-[140px] overflow-y-auto flex flex-col gap-2.5 no-scrollbar">
                      {liveTranscript.map((t, i) => (
                        <div key={i} className={`flex flex-col gap-0.5 ${t.role === "user" ? "items-end" : "items-start"}`}>
                          <span className={`font-mono text-[9px] uppercase tracking-widest ${t.role === "user" ? "text-text-lo" : "text-signal"}`}>
                            {t.role === "user" ? "You" : "Hammad's AI"}
                          </span>
                          <p className={`text-xs leading-relaxed max-w-[90%] ${t.role === "user" ? "text-text-mid" : "text-text-hi"}`}>{t.message}</p>
                        </div>
                      ))}
                      <div ref={liveTranscriptEndRef} />
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const next = !isMuted;
                        setIsMuted(next);
                        conversationRef.current?.setMicMuted(next);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 font-mono text-mono-label uppercase tracking-widest py-2.5 rounded-lg border transition-colors ${
                        isMuted
                          ? "bg-warn/10 text-warn border-warn/30 hover:bg-warn/20"
                          : "border-ink-600 text-text-lo hover:border-text-lo hover:text-text-mid"
                      }`}
                    >
                      {isMuted ? <MicOffSVG /> : <MicSVG />}
                      {isMuted ? "Muted" : "Mute"}
                    </button>
                    <button onClick={() => void handleCallEnd()}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-danger/10 text-danger border border-danger/30 font-mono text-mono-label uppercase tracking-widest py-2.5 rounded-lg hover:bg-danger/20 transition-colors">
                      <PhoneSVG size={14} />
                      End
                    </button>
                  </div>
                </div>
              )}

              {/* ── ENDED — post-call summary ── */}
              {callState === "ended" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-ink-700 border border-ink-600 flex items-center justify-center text-text-lo font-mono font-bold text-[10px]">HA</div>
                    <div>
                      <p className="text-text-mid text-xs">Call ended · {formatDuration(callDuration)}</p>
                    </div>
                  </div>

                  {liveTranscript.length > 0 && (
                    <div className="bg-ink-900 rounded-lg p-2.5 max-h-[160px] overflow-y-auto flex flex-col gap-2 no-scrollbar">
                      <p className="font-mono text-[9px] text-text-lo uppercase tracking-widest mb-1">Conversation recap</p>
                      {liveTranscript.map((t, i) => (
                        <p key={i} className="text-xs leading-relaxed">
                          <span className={`font-mono text-[9px] font-bold mr-1.5 ${t.role === "user" ? "text-text-lo" : "text-signal"}`}>
                            {t.role === "user" ? "You:" : "AI:"}
                          </span>
                          <span className={t.role === "user" ? "text-text-mid" : "text-text-hi"}>{t.message}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => { document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); closePanel(); }}
                    className="w-full bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest py-2.5 rounded-lg hover:bg-signal-dim transition-colors"
                  >
                    Contact Hammad →
                  </button>
                  <button
                    onClick={() => { setCallState("idle"); setLiveTranscript([]); setCallDuration(0); }}
                    className="text-center font-mono text-[10px] text-text-lo hover:text-text-mid transition-colors uppercase tracking-widest"
                  >
                    Call again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Teaser + FAB — single stacked container, anchored bottom-right ── */}
      <div className={`fixed ${FAB_BOTTOM} z-[301] flex flex-col items-end gap-3 pointer-events-none`}>

        {/* Teaser card — sits directly above the pill */}
        <AnimatePresence>
          {teaserVisible && activePanel === null && featFlags.chat && (
            <motion.div
              key="teaser"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-auto w-[min(260px,calc(100vw-3.5rem))] bg-ink-800 border border-ink-600 rounded-xl overflow-hidden shadow-[0_4px_32px_rgba(0,0,0,.55)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal flex-shrink-0" style={{ animation: "sdDotBounce 2s ease-in-out infinite" }} />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-hi">Ask My Portfolio</span>
                </div>
                <button onClick={dismissTeaser} aria-label="Dismiss" className="text-text-lo hover:text-text-hi transition-colors p-0.5">
                  <CloseSVG />
                </button>
              </div>

              {/* Rotating prompt */}
              <button
                onClick={() => {
                  const prompt = TEASER_PROMPTS[teaserIdx] ?? TEASER_PROMPTS[0]!;
                  dismissTeaser();
                  openPanel("chat");
                  void sendMessage(prompt);
                }}
                className="w-full text-left px-3 py-3 hover:bg-ink-700 transition-colors group"
              >
                <AnimatePresence mode="wait">
                  <motion.p
                    key={teaserIdx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm text-text-mid group-hover:text-text-hi transition-colors leading-snug"
                  >
                    &ldquo;{TEASER_PROMPTS[teaserIdx]}&rdquo;
                  </motion.p>
                </AnimatePresence>
                <span className="font-mono text-[10px] text-signal uppercase tracking-widest mt-2 block">Ask →</span>
              </button>

              {/* Voice call CTA — only when voice feature is enabled */}
              {featFlags.voice && (
                <div className="border-t border-line">
                  <button
                    onClick={() => { dismissTeaser(); openPanel("call"); }}
                    aria-label="Start AI voice call"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-ink-700 transition-colors group"
                  >
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-signal" />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-text-lo group-hover:text-text-mid transition-colors">
                      Or start a voice call
                    </span>
                    <span className="font-mono text-[10px] text-signal uppercase tracking-widest ml-auto">AI Call →</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB pill */}
        <AnimatePresence mode="wait">
          {activePanel ? (
            /* ── Panel open: close button — hidden on mobile (panel header has its own X) ── */
            <motion.button
              key="close-pill"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              onClick={closePanel}
              aria-label="Close"
              whileTap={{ scale: 0.95 }}
              className="pointer-events-auto hidden sm:flex items-center gap-2 h-9 2xl:h-11 px-4 2xl:px-5 rounded-full bg-ink-700 border border-ink-600 text-text-hi shadow-[0_4px_24px_rgba(0,0,0,.5)] hover:border-signal hover:text-signal transition-colors"
            >
              <CloseSVG />
              <span className="font-mono text-mono-label uppercase tracking-widest">Close</span>
            </motion.button>
          ) : (featFlags.chat && featFlags.voice) ? (
            /* ── Both enabled: lime split pill ── */
            <motion.div
              key="split-pill"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-auto flex items-center rounded-full bg-signal shadow-[0_4px_20px_rgba(198,255,58,0.2),0_4px_12px_rgba(0,0,0,0.4)] 2xl:shadow-[0_4px_28px_rgba(198,255,58,0.25),0_4px_16px_rgba(0,0,0,0.4)]"
            >
              <button
                onClick={() => openPanel("chat")}
                aria-label="Open AI chat"
                className="flex items-center gap-2 h-9 pl-3.5 pr-3 2xl:h-12 2xl:pl-4 2xl:pr-3.5 text-signal-ink hover:bg-signal-dim transition-colors active:scale-[.97] rounded-l-full"
              >
                <span className="relative flex h-2 w-2 2xl:h-2.5 2xl:w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-ink opacity-50" />
                  <span className="relative inline-flex rounded-full h-2 w-2 2xl:h-2.5 2xl:w-2.5 bg-signal-ink" />
                </span>
                <span className="font-mono text-[10px] 2xl:text-[11px] font-bold uppercase tracking-widest">Chat</span>
              </button>
              <span className="h-4 2xl:h-5 w-px bg-signal-ink/25 flex-shrink-0" />
              <button
                onClick={() => openPanel("call")}
                aria-label="Open AI voice call"
                className="flex items-center gap-1.5 2xl:gap-2 h-9 pl-3 pr-3.5 2xl:h-12 2xl:pl-3.5 2xl:pr-4 text-signal-ink hover:bg-signal-dim transition-colors active:scale-[.97] rounded-r-full"
              >
                <PhoneSVG size={14} />
                <span className="font-mono text-[10px] 2xl:text-[11px] font-bold uppercase tracking-widest">AI Call</span>
              </button>
            </motion.div>
          ) : featFlags.chat ? (
            /* ── Chat only: compact dark icon FAB ── */
            <motion.button
              key="chat-fab"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              onClick={() => openPanel("chat")}
              aria-label="Open AI chat"
              whileTap={{ scale: 0.95 }}
              className="pointer-events-auto relative w-12 h-12 2xl:w-14 2xl:h-14 rounded-full bg-ink-800 border border-signal text-signal flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:bg-ink-700 transition-colors"
            >
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-signal border-2 border-ink-900" style={{ animation: "sdDotBounce 2s ease-in-out infinite" }} />
              <ChatSVG />
            </motion.button>
          ) : featFlags.voice ? (
            /* ── Voice only: compact dark icon FAB ── */
            <motion.button
              key="voice-fab"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              onClick={() => openPanel("call")}
              aria-label="Open AI voice call"
              whileTap={{ scale: 0.95 }}
              className="pointer-events-auto relative w-12 h-12 2xl:w-14 2xl:h-14 rounded-full bg-ink-800 border border-signal text-signal flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:bg-ink-700 transition-colors"
            >
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-signal border-2 border-ink-900 animate-pulse" />
              <PhoneSVG size={20} />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ── Diagram overlay — full-screen modal, call stays active ── */}
      <AnimatePresence>
        {showDiagram && (
          <motion.div
            key="diagram-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400] bg-ink-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-6"
            onClick={() => setShowDiagram(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative bg-ink-800 border border-ink-600 rounded-xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.8)] max-w-3xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-ink-600">
                <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest">Architecture · {showDiagram.slug}</p>
                <button onClick={() => setShowDiagram(null)} aria-label="Close diagram" className="text-text-lo hover:text-text-hi transition-colors p-1">
                  <CloseSVG />
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={showDiagram.url} alt={`Architecture diagram for ${showDiagram.slug}`} className="w-full h-auto max-h-[70vh] object-contain" />
            </motion.div>
            <p className="font-mono text-[10px] text-text-lo uppercase tracking-widest mt-4">Click outside to close</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Project card — floats top-right during voice call, auto-dismisses ── */}
      <AnimatePresence>
        {showProjectCard && (
          <motion.div
            key="project-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-3 z-[350] w-[min(280px,calc(100vw-1.5rem))] bg-ink-800 border border-ink-600 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,.55)]"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-line">
              <p className="font-mono text-[9px] text-signal uppercase tracking-widest">AI Suggestion · Project</p>
              <button onClick={() => setShowProjectCard(null)} aria-label="Dismiss" className="text-text-lo hover:text-text-hi transition-colors p-0.5">
                <CloseSVG />
              </button>
            </div>
            <a
              href={`/projects/${showProjectCard.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-3 hover:bg-ink-700 transition-colors group"
              onClick={() => setShowProjectCard(null)}
            >
              <p className="text-sm text-text-hi group-hover:text-signal transition-colors leading-snug mb-1">{showProjectCard.title}</p>
              <span className="font-mono text-[10px] text-signal uppercase tracking-widest">View Project →</span>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Blog suggestion card — floats top-right, auto-dismisses ── */}
      <AnimatePresence>
        {showBlogCard && (
          <motion.div
            key="blog-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-3 z-[350] w-[min(280px,calc(100vw-1.5rem))] bg-ink-800 border border-ink-600 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,.55)]"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-line">
              <p className="font-mono text-[9px] text-signal uppercase tracking-widest">AI Suggestion · Blog Post</p>
              <button onClick={() => setShowBlogCard(null)} aria-label="Dismiss" className="text-text-lo hover:text-text-hi transition-colors p-0.5">
                <CloseSVG />
              </button>
            </div>
            <a
              href={`/blog/${showBlogCard.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-3 hover:bg-ink-700 transition-colors group"
              onClick={() => setShowBlogCard(null)}
            >
              <p className="text-sm text-text-hi group-hover:text-signal transition-colors leading-snug mb-1">{showBlogCard.title}</p>
              <span className="font-mono text-[10px] text-signal uppercase tracking-widest">Read →</span>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Visitor count toast — top-right, auto-dismisses ── */}
      <AnimatePresence>
        {showVisitorToast && (
          <motion.div
            key="visitor-toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-3 z-[360] flex items-center gap-2.5 bg-ink-800 border border-ink-600 rounded-full px-4 py-2 shadow-[0_4px_24px_rgba(0,0,0,.5)]"
          >
            <span className="w-2 h-2 rounded-full bg-signal flex-shrink-0" style={{ animation: "sdDotBounce 2s ease-in-out infinite" }} />
            <span className="font-mono text-[11px] text-text-hi uppercase tracking-widest tabular-nums">
              {showVisitorToast.count} {showVisitorToast.count === 1 ? "visitor" : "visitors"} online now
            </span>
            <button onClick={() => setShowVisitorToast(null)} aria-label="Dismiss" className="text-text-lo hover:text-text-hi transition-colors ml-1">
              <CloseSVG />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
