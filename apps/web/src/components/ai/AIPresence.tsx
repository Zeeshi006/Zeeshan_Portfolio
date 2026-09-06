"use client";
import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

type CallState = "idle" | "ringing" | "active" | "ended";

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}

function SoundWave({ active }: { active: boolean }) {
  const bars = [3, 5, 8, 5, 3, 6, 9, 6, 3, 5, 8, 5, 3];
  return (
    <div className="flex items-center gap-[3px] h-8">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-signal"
          animate={active ? {
            height: [`${h * 2}px`, `${h * 5}px`, `${h * 2}px`],
          } : { height: "4px" }}
          transition={active ? {
            duration: 0.6 + i * 0.05,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.04,
          } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

export function AIPresence() {
  const [callState, setCallState] = useState<CallState>("idle");
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => { setOpen(false); setCallState("idle"); }, []);

  const handleCall = useCallback(() => {
    setCallState("ringing");
    setTimeout(() => setCallState("active"), 2000);
  }, []);

  const handleEnd = useCallback(() => {
    setCallState("ended");
    setTimeout(() => { setCallState("idle"); setOpen(false); }, 1500);
  }, []);

  return (
    <>
      {/* ── Floating call button ── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="call-btn"
            onClick={handleOpen}
            aria-label="Talk to AI voice agent"
            className="fixed bottom-[5.5rem] right-4 z-[200] group flex flex-col items-center gap-1.5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3 }}
          >
            {/* Tooltip */}
            <span className="font-mono text-[0.7rem] text-text-lo uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-ink-800 border border-line rounded px-2 py-1">
              Voice AI Demo
            </span>
            {/* Button */}
            <div className="relative w-14 h-14 rounded-full bg-signal flex items-center justify-center text-signal-ink shadow-lg hover:bg-signal-dim transition-colors active:scale-95"
              style={{ boxShadow: "0 0 20px 4px rgba(198,255,58,0.25)" }}>
              <PhoneIcon />
              {/* Ping ring */}
              <span className="absolute inset-0 rounded-full border-2 border-signal/40 animate-ping" style={{ animationDuration: "2s" }} />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Call modal ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[300]"
              initial={{ opacity: 0 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
              onClick={callState === "idle" ? handleClose : undefined}
            />

            {/* Card */}
            <motion.div
              className="fixed z-[301] bottom-28 right-3 w-[calc(100vw-1.5rem)] max-w-[340px] max-h-[70vh] overflow-y-auto pointer-events-auto"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            >
              <div className="w-full bg-ink-800 border border-ink-600 rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: 520 }}>
                {/* Header — sticky so it's always visible */}
                <div className="bg-ink-900 px-5 py-3 flex items-center justify-between border-b border-line flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-signal/10 border border-signal/30 flex items-center justify-center">
                      <span className="text-signal text-xs font-mono">AI</span>
                    </div>
                    <div>
                      <p className="font-mono text-small text-text-hi">Portfolio AI</p>
                      <p className="font-mono text-mono-label text-text-lo">Voice Agent · ElevenLabs</p>
                    </div>
                  </div>
                  {callState === "idle" && (
                    <button onClick={handleClose} className="text-text-lo hover:text-text-mid transition-colors font-mono text-sm">✕</button>
                  )}
                </div>

                {/* Body */}
                <div className="px-5 py-5 flex flex-col items-center gap-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {callState === "idle" && (
                    <>
                      <div className="text-center">
                        <p className="text-text-hi font-display text-h3 mb-2">Talk to my AI</p>
                        <p className="text-text-mid text-small leading-relaxed">
                          Ask about my experience, projects, or skills. Powered by ElevenLabs voice agents.
                        </p>
                      </div>
                      <div className="flex flex-row flex-wrap gap-1.5 w-full justify-center">
                        {["Voice agent CRM?", "Strongest skill?", "Open to remote?"].map(q => (
                          <span key={q} className="font-mono text-[0.65rem] leading-none text-text-lo border border-line rounded-full px-2.5 py-1 bg-ink-900 whitespace-nowrap">
                            {q}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={handleCall}
                        className="w-full bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn py-3.5 hover:bg-signal-dim active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <PhoneIcon />
                        Start Call
                      </button>
                      <p className="font-mono text-mono-label text-text-lo text-center">
                        ElevenLabs key not yet configured — demo mode
                      </p>
                    </>
                  )}

                  {callState === "ringing" && (
                    <div className="flex flex-col items-center gap-4 py-4">
                      <motion.div
                        className="w-16 h-16 rounded-full bg-signal/10 border-2 border-signal/30 flex items-center justify-center"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <PhoneIcon />
                      </motion.div>
                      <p className="font-mono text-small text-text-mid">Connecting…</p>
                    </div>
                  )}

                  {callState === "active" && (
                    <div className="flex flex-col items-center gap-5 w-full py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
                        <span className="font-mono text-small text-ok">Live</span>
                      </div>
                      <SoundWave active />
                      <p className="font-mono text-small text-text-mid text-center">
                        AI is speaking… (ElevenLabs TTS)
                      </p>
                      <div className="flex items-center justify-center gap-4 w-full mt-2">
                        <button className="w-12 h-12 rounded-full bg-ink-700 border border-line flex items-center justify-center text-text-mid hover:border-signal hover:text-signal transition-colors">
                          <MicIcon />
                        </button>
                        <button
                          onClick={handleEnd}
                          className="w-14 h-14 rounded-full bg-danger flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" transform="rotate(135 12 12)"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {callState === "ended" && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="font-mono text-small text-text-mid">Call ended</p>
                      <p className="font-mono text-mono-label text-text-lo">Add ElevenLabs key to activate</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
