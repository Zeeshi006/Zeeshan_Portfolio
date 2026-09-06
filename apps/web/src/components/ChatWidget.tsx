'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionId } from '@/lib/analytics';

interface Source {
  id: string;
  title: string;
}

interface ToolCall {
  name: string;
  args: { sectionId?: string; projectSlug?: string };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  toolCalls?: ToolCall[];
  timestamp: Date;
  feedback?: 'up' | 'down' | null;
}

const SUGGESTED_PROMPTS = [
  'How did he build the voice agents?',
  "What's his strongest project?",
  'Is he open to remote?',
];

const ESCALATION_TRIGGERS = [
  "i don't have that info",
  "don't have that info",
  "ask hammad directly",
  "no relevant documents",
];

function isEscalationResponse(text: string): boolean {
  const lower = text.toLowerCase();
  return ESCALATION_TRIGGERS.some((t) => lower.includes(t));
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-text-mid"
          style={{
            animation: 'chatDotBounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}


function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();

    // Empty line → small spacer
    if (!line) {
      if (nodes.length > 0) nodes.push(<div key={`gap-${i}`} style={{ height: '4px' }} />);
      return;
    }

    // ### or ## heading → mono uppercase label (never copy KB headers verbatim)
    if (line.startsWith('### ') || line.startsWith('## ')) {
      const content = line.replace(/^#{2,3}\s/, '').replace(/:$/, '');
      nodes.push(
        <div key={i} style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
          color: 'var(--text-lo)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginTop: nodes.length ? '10px' : 0, marginBottom: '2px',
        }}>
          {content}
        </div>
      );
      return;
    }

    // Bullet: – or -
    if (/^[–\-]\s/.test(line)) {
      const content = line.replace(/^[–\-]\s/, '');
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <span style={{ color: 'var(--signal)', flexShrink: 0, userSelect: 'none' }}>–</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      return;
    }

    // Regular text line
    nodes.push(<div key={i}>{renderInline(line)}</div>);
  });

  return <>{nodes}</>;
}

function EscalationCard() {
  return (
    <div
      className="mt-3 p-3 rounded-lg border"
      style={{ background: 'var(--ink-900)', borderColor: 'var(--ink-600)' }}
    >
      <p className="font-mono text-xs text-text-lo uppercase tracking-widest mb-2">
        Reach Hammad directly
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href="#contact"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-widest transition-colors"
          style={{
            background: 'var(--signal)',
            color: 'var(--signal-ink)',
          }}
        >
          Email →
        </a>
        <a
          href="#contact"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-widest border transition-colors"
          style={{
            borderColor: 'var(--ink-600)',
            color: 'var(--text-hi)',
          }}
        >
          Contact Form
        </a>
      </div>
    </div>
  );
}

function slugToTitle(slug: string): string {
  const words = slug.split('-').slice(0, 2);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const SECTION_LABELS: Record<string, string> = {
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  'case-studies': 'Case Studies',
  contact: 'Contact',
};

function NavChips({
  toolCalls,
  onNavigate,
}: {
  toolCalls: ToolCall[];
  onNavigate: (tc: ToolCall) => void;
}) {
  const chips = toolCalls.slice(0, 3);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {chips.map((tc, i) => {
        const label =
          tc.name === 'navigateToSection'
            ? (SECTION_LABELS[tc.args.sectionId ?? ''] ?? tc.args.sectionId ?? 'Section')
            : tc.name === 'openProject'
              ? slugToTitle(tc.args.projectSlug ?? '')
              : tc.name;
        return (
          <button
            key={i}
            onClick={() => onNavigate(tc)}
            className="inline-flex items-center gap-2 bg-ink-800 border border-ink-600 rounded-full px-4 py-1.5 font-mono text-mono-label text-text-mid hover:border-signal hover:text-signal transition-colors"
          >
            <span style={{ color: '#C6FF3A' }}>📍</span>
            {label}
            <span>→</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ChatWidget() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [navCountdown, setNavCountdown] = useState<{ tc: ToolCall; label: string } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to avoid stale closures on messages in the send callback
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-chat', handler);
    return () => window.removeEventListener('open-chat', handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Auto-navigate when the last assistant message has tool calls.
  // Shows a countdown banner so user knows navigation is coming and can cancel.
  useEffect(() => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);

    if (isLoading) {
      setNavCountdown(null);
      return;
    }

    const lastMsg = messages[messages.length - 1];
    const hasToolCalls = !!(lastMsg?.role === 'assistant' && lastMsg.toolCalls?.length);
    if (process.env.NODE_ENV === 'development') console.log('[chat] nav effect: isLoading=', isLoading, 'lastRole=', lastMsg?.role, 'toolCalls=', JSON.stringify(lastMsg?.toolCalls));

    if (!hasToolCalls) {
      setNavCountdown(null);
      return;
    }

    const tc = lastMsg!.toolCalls![0]!;
    const label =
      tc.name === 'navigateToSection'
        ? (SECTION_LABELS[tc.args.sectionId ?? ''] ?? tc.args.sectionId ?? 'Section')
        : slugToTitle(tc.args.projectSlug ?? '');

    if (process.env.NODE_ENV === 'development') console.log('[chat] queuing navigation to:', tc.name, JSON.stringify(tc.args), '→ label:', label);
    setNavCountdown({ tc, label });

    navTimerRef.current = setTimeout(() => {
      if (process.env.NODE_ENV === 'development') console.log('[chat] executing navigation:', tc.name, JSON.stringify(tc.args));
      setNavCountdown(null);
      setIsOpen(false);
      if (tc.name === 'navigateToSection' && tc.args.sectionId) {
        const el = document.getElementById(tc.args.sectionId);
        if (process.env.NODE_ENV === 'development') console.log('[chat] scrolling to element:', tc.args.sectionId, '→ found:', !!el);
        el?.scrollIntoView({ behavior: 'smooth' });
      } else if (tc.name === 'openProject' && tc.args.projectSlug) {
        void router.push('/projects/' + tc.args.projectSlug);
      }
    }, 2500);

    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, [messages, isLoading, router]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, input, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setIsOpen(false); fabRef.current?.focus(); return; }
      if (e.key === 'Tab') {
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus(); } }
        else { if (document.activeElement === last) { e.preventDefault(); first?.focus(); } }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const copyMessage = useCallback((text: string, idx: number) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }, []);

  const submitFeedback = useCallback((idx: number, thumbsUp: boolean, content: string) => {
    setMessages((prev) => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx]!, feedback: thumbsUp ? 'up' : 'down' };
      return next;
    });
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    fetch(`${apiUrl}/chat/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getSessionId(),
        messageContent: content.slice(0, 500),
        thumbsUp,
      }),
    }).catch(() => {});
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const query = text.trim();
      if (!query || isLoading) return;

      const now = new Date();
      const history = messagesRef.current
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, { role: 'user', content: query, timestamp: now }]);
      setInput('');
      setIsLoading(true);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const body = JSON.stringify({
        query,
        sessionId: getSessionId(),
        history,
      });

      // ── Try SSE streaming first ───────────────────────────────────────────────
      try {
        if (process.env.NODE_ENV === 'development') console.log('[chat] starting SSE stream for:', query);
        const res = await fetch(`${apiUrl}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

        if (!res.ok || !res.body) throw new Error('no stream');
        if (process.env.NODE_ENV === 'development') console.log('[chat] SSE stream connected, status:', res.status);

        // Add empty assistant message immediately so text appears as it arrives
        setMessages((prev) => [...prev, { role: 'assistant', content: '', sources: [], toolCalls: [], timestamp: new Date() }]);
        setIsLoading(false);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            if (!part.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(part.slice(6)) as {
                token?: string;
                sources?: Source[];
                toolCalls?: ToolCall[];
                done?: boolean;
                error?: boolean;
              };

              if (event.token) {
                setMessages((prev) => {
                  const msgs = [...prev];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, content: last.content + event.token };
                  }
                  return msgs;
                });
              }
              if (event.sources) {
                if (process.env.NODE_ENV === 'development') console.log('[chat] SSE sources received:', event.sources.length, 'docs');
                setMessages((prev) => {
                  const msgs = [...prev];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, sources: event.sources ?? [] };
                  }
                  return msgs;
                });
              }
              if (event.toolCalls) {
                if (process.env.NODE_ENV === 'development') console.log('[chat] SSE toolCalls received:', JSON.stringify(event.toolCalls));
                setMessages((prev) => {
                  const msgs = [...prev];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, toolCalls: event.toolCalls ?? [] };
                  }
                  return msgs;
                });
              }
              if (event.done) { if (process.env.NODE_ENV === 'development') console.log('[chat] SSE done received'); break outer; }
              if (event.error) { console.error('[chat] SSE error received'); break outer; }
            } catch (e) { console.warn('[chat] SSE parse error:', e); }
          }
        }
        if (process.env.NODE_ENV === 'development') console.log('[chat] SSE stream finished');
        return;
      } catch (e) {
        console.warn('[chat] SSE failed, falling back to POST:', e);
      }

      // ── Fallback: regular JSON endpoint ──────────────────────────────────────
      try {
        const res = await fetch(`${apiUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { answer: string; sources: Source[]; toolCalls?: ToolCall[] };
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer,
            sources: data.sources ?? [],
            toolCalls: data.toolCalls ?? [],
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Something went wrong. Try again.', sources: [], timestamp: new Date() },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  function handleNavChip(tc: ToolCall) {
    setIsOpen(false);
    setTimeout(() => {
      if (tc.name === 'navigateToSection' && tc.args.sectionId) {
        document.getElementById(tc.args.sectionId)?.scrollIntoView({ behavior: 'smooth' });
      } else if (tc.name === 'openProject' && tc.args.projectSlug) {
        void router.push('/projects/' + tc.args.projectSlug);
      }
    }, 80);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function handleSuggestedPrompt(prompt: string) {
    void sendMessage(prompt);
  }

  function clearConversation() {
    setMessages([]);
  }

  const lastMsg = messages[messages.length - 1];
  const showEscalation =
    lastMsg?.role === 'assistant' && isEscalationResponse(lastMsg.content) && !isLoading;

  return (
    <>
      <style>{`
        @keyframes chatDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes chatPanelIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .chat-panel { animation: none !important; }
          .chat-dot   { animation: none !important; }
        }
      `}</style>

      {/* FAB */}
      <button
        ref={fabRef}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close chat panel' : 'Open chat — Ask my portfolio'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 101,
          width: '52px', height: '52px', borderRadius: '50%',
          background: isOpen ? 'var(--signal-dim)' : 'var(--signal)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          transition: 'background 150ms ease, transform 150ms ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--signal-dim)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = isOpen ? 'var(--signal-dim)' : 'var(--signal)')}
        onFocus={(e) => ((e.currentTarget as HTMLButtonElement).style.outline = '2px solid var(--signal)')}
        onBlur={(e) => ((e.currentTarget as HTMLButtonElement).style.outline = 'none')}
        onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)')}
        onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: 'var(--signal-ink)' }}>
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--signal-ink)' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Portfolio chatbot"
          aria-modal="true"
          className="chat-panel"
          style={{
            position: 'fixed', bottom: '88px', right: '24px', zIndex: 100,
            width: '380px', maxHeight: '560px',
            background: 'var(--ink-800)', border: '1px solid var(--ink-600)',
            borderRadius: '12px', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
            animation: 'chatPanelIn 200ms ease-out forwards',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 16px 12px', borderBottom: '1px solid var(--ink-600)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: 'var(--signal)', display: 'inline-block',
                animation: 'chatDotBounce 2s ease-in-out infinite',
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.8125rem',
                fontWeight: 500, color: 'var(--text-hi)', letterSpacing: '0.04em',
              }}>
                ASK MY PORTFOLIO
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  title="Clear conversation"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-lo)', transition: 'color 150ms ease' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-mid)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-lo)')}
                  aria-label="Clear conversation"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => { setIsOpen(false); fabRef.current?.focus(); }}
                aria-label="Close chat"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-lo)', transition: 'color 150ms ease' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-hi)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-lo)')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1, overflowY: 'auto', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '12px',
              scrollbarWidth: 'thin', scrollbarColor: 'var(--ink-600) transparent',
            }}
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-mid)', lineHeight: 1.6, margin: 0 }}>
                  Ask me anything about Hammad&apos;s experience, projects, or skills.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSuggestedPrompt(prompt)}
                      style={{
                        textAlign: 'left', background: 'var(--ink-700)',
                        border: '1px solid var(--ink-600)', borderRadius: '8px',
                        padding: '8px 12px', cursor: 'pointer',
                        fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
                        color: 'var(--text-mid)', transition: 'border-color 150ms ease, color 150ms ease',
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.borderColor = 'var(--signal)';
                        btn.style.color = 'var(--text-hi)';
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.borderColor = 'var(--ink-600)';
                        btn.style.color = 'var(--text-mid)';
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isErrorMsg = !isUser && msg.content === 'Something went wrong. Try again.';
              const isLastAssistant = !isUser && i === messages.length - 1;
              const showEscCard = isLastAssistant && showEscalation;

              return (
                <div
                  key={i}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}
                >
                  {/* Timestamp */}
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                    color: 'var(--text-lo)', marginBottom: '3px',
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                  }}>
                    {formatTime(msg.timestamp)}
                  </span>

                  {/* Bubble + copy button row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', maxWidth: '85%', flexDirection: isUser ? 'row-reverse' : 'row' }}>
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        background: isUser ? 'var(--signal)' : isErrorMsg ? 'rgba(248,81,73,0.12)' : 'var(--ink-700)',
                        color: isUser ? 'var(--signal-ink)' : isErrorMsg ? 'var(--danger)' : 'var(--text-hi)',
                        fontFamily: 'var(--font-body)', fontSize: '0.875rem', lineHeight: 1.6,
                        border: isErrorMsg ? '1px solid rgba(248,81,73,0.3)' : 'none',
                      }}
                    >
                      {msg.content ? renderMarkdown(msg.content) : (isLoading && isLastAssistant ? null : ' ')}
                    </div>
                    {/* Copy button (assistant only) */}
                    {!isUser && msg.content && (
                      <button
                        onClick={() => copyMessage(msg.content, i)}
                        title="Copy"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '2px', color: copiedIdx === i ? 'var(--signal)' : 'var(--text-lo)',
                          transition: 'color 150ms ease', flexShrink: 0, marginTop: '4px',
                        }}
                        aria-label="Copy response"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {copiedIdx === i
                            ? <><polyline points="20 6 9 17 4 12" /></>
                            : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>
                          }
                        </svg>
                      </button>
                    )}
                  </div>

                  {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <NavChips toolCalls={msg.toolCalls} onNavigate={handleNavChip} />
                  )}

                  {/* Escalation card */}
                  {showEscCard && <EscalationCard />}

                  {/* Feedback buttons (assistant only, not for error messages) */}
                  {!isUser && msg.content && !isErrorMsg && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      <button
                        onClick={() => submitFeedback(i, true, msg.content)}
                        title="Helpful"
                        aria-label="Mark as helpful"
                        style={{
                          background: 'none', border: 'none', cursor: msg.feedback ? 'default' : 'pointer',
                          padding: '2px 4px', borderRadius: '4px',
                          color: msg.feedback === 'up' ? 'var(--ok)' : 'var(--text-lo)',
                          transition: 'color 150ms ease', fontSize: '12px',
                        }}
                      >
                        👍
                      </button>
                      <button
                        onClick={() => submitFeedback(i, false, msg.content)}
                        title="Not helpful"
                        aria-label="Mark as not helpful"
                        style={{
                          background: 'none', border: 'none', cursor: msg.feedback ? 'default' : 'pointer',
                          padding: '2px 4px', borderRadius: '4px',
                          color: msg.feedback === 'down' ? 'var(--danger)' : 'var(--text-lo)',
                          transition: 'color 150ms ease', fontSize: '12px',
                        }}
                      >
                        👎
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--ink-700)', borderRadius: '12px 12px 12px 4px' }}>
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Navigation countdown banner */}
          {navCountdown && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px', flexShrink: 0,
              background: 'rgba(198, 255, 58, 0.06)',
              borderTop: '1px solid rgba(198, 255, 58, 0.18)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--signal)', fontSize: '13px', lineHeight: 1 }}>📍</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--signal)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Taking you to {navCountdown.label}…
                </span>
              </div>
              <button
                onClick={() => {
                  if (navTimerRef.current) clearTimeout(navTimerRef.current);
                  navTimerRef.current = null;
                  setNavCountdown(null);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                  color: 'var(--text-lo)', letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '2px 6px',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-mid)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-lo)')}
              >
                Stay
              </button>
            </div>
          )}

          {/* Input form */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex', gap: '8px', padding: '12px 16px',
              borderTop: '1px solid var(--ink-600)', flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={isLoading}
              aria-label="Chat message input"
              style={{
                flex: 1, background: 'var(--ink-700)', border: '1px solid var(--ink-600)',
                borderRadius: '8px', padding: '8px 12px',
                fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-hi)',
                outline: 'none', transition: 'border-color 150ms ease',
              }}
              onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = 'var(--signal)')}
              onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = 'var(--ink-600)')}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              style={{
                background: isLoading || !input.trim() ? 'var(--ink-600)' : 'var(--signal)',
                border: 'none', borderRadius: '8px', padding: '8px 14px',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                color: isLoading || !input.trim() ? 'var(--text-lo)' : 'var(--signal-ink)',
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500,
                letterSpacing: '0.06em', transition: 'background 150ms ease, color 150ms ease', outline: 'none', flexShrink: 0,
              }}
            >
              SEND
            </button>
          </form>
        </div>
      )}
    </>
  );
}
