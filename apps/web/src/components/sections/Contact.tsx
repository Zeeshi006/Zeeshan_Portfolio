"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionReveal } from "@/components/SectionReveal";
import { trackConversion } from "@/lib/analytics";

const EMAIL = "hammad.afzal.code@gmail.com";

const PLACEHOLDERS = [
  "Hi Hammad, I have a backend project in mind...",
  "We're hiring senior engineers and found your portfolio...",
  "I'd love to know how you built the RAG pipeline...",
  "Looking for a full-stack engineer for our startup...",
  "Your system design impressed me — let's talk...",
];

function useTypingPlaceholder(strings: string[], delay = 3200) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const target = strings[index] ?? "";
    if (typing) {
      if (displayed.length < target.length) {
        frameRef.current = setTimeout(
          () => setDisplayed(target.slice(0, displayed.length + 1)),
          38,
        );
      } else {
        frameRef.current = setTimeout(() => setTyping(false), delay);
      }
    } else {
      if (displayed.length > 0) {
        frameRef.current = setTimeout(
          () => setDisplayed(displayed.slice(0, -1)),
          18,
        );
      } else {
        setIndex((i) => (i + 1) % strings.length);
        setTyping(true);
      }
    }
    return () => {
      if (frameRef.current) clearTimeout(frameRef.current);
    };
  }, [displayed, typing, index, strings, delay]);

  return displayed;
}

function SendingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-1 h-1 rounded-full bg-signal-ink"
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

export function Contact() {
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [focusedField, setFocusedField] = useState<"email" | "message" | null>(
    null,
  );
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const placeholder = useTypingPlaceholder(PLACEHOLDERS);

  // Listen for voice agent prefill-contact events
  useEffect(() => {
    const handler = (e: Event) => {
      const prefillMessage = (e as CustomEvent<{ message: string }>).detail
        ?.message;
      if (prefillMessage) {
        setMessage(prefillMessage);
        setTimeout(() => {
          messageRef.current?.focus();
          messageRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 100);
      }
    };
    window.addEventListener("prefill-contact", handler);
    return () => window.removeEventListener("prefill-contact", handler);
  }, []);

  function handleCopyEmail() {
    void navigator.clipboard.writeText(EMAIL).then(() => {
      trackConversion("email_click");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ""}/contact`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: from,
            message,
            name: "Portfolio visitor",
          }),
        },
      );
      if (res.ok) {
        trackConversion("contact_submit");
        setState("done");
      } else setState("error");
    } catch {
      setState("error");
    }
  }

  return (
    <section
      id="contact"
      className="py-24 md:py-32 border-t border-line overflow-hidden"
    >
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[140px_1fr] md:gap-10 md:items-start">
          <div className="hidden md:block">
            <SectionReveal>
              <p className="section-index">04 / CONTACT</p>
            </SectionReveal>
          </div>

          <div className="space-y-12 min-w-0">
            {/* Heading */}
            <SectionReveal>
              <div>
                <p className="section-index md:hidden mb-2">04 / CONTACT</p>
                <h2 className="text-display-l font-display text-text-hi">
                  Let&apos;s talk
                </h2>
                <p className="text-text-mid mt-3 max-w-xl">
                  Open to senior backend / full-stack remote roles. Response
                  time: same business day.
                </p>
              </div>
            </SectionReveal>

            {/* Hero email action */}
            <SectionReveal delay={0.05}>
              <button
                type="button"
                onClick={handleCopyEmail}
                aria-label="Copy email address"
                className="group w-full bg-ink-800 border border-ink-600 rounded-card px-6 py-5 hover:border-signal/40 transition-all duration-200 cursor-pointer text-left"
              >
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest block mb-2">
                      Email
                    </span>
                    <span
                      className="font-mono text-sm text-text-hi group-hover:text-signal transition-colors block"
                      style={{ wordBreak: "break-all" }}
                    >
                      {EMAIL}
                    </span>
                  </div>
                  <span className="font-mono text-mono-label flex-shrink-0 transition-colors mt-0.5">
                    {copied ? (
                      <span className="text-signal">Copied ✓</span>
                    ) : (
                      <span className="text-text-mid group-hover:text-signal">
                        ⎘ Copy
                      </span>
                    )}
                  </span>
                </div>
              </button>
            </SectionReveal>

            {/* Primary action pills */}
            <SectionReveal delay={0.1}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <a
                  href="https://wa.me/923072024974?text=Hi%20Hammad%2C%20I%20found%20your%20portfolio%20and%20would%20like%20to%20connect."
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackConversion("whatsapp_click")}
                  className="flex items-center justify-between bg-ink-800 border border-ink-600 rounded-card px-5 py-5 hover:border-signal/40 hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div>
                    <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-2">
                      WhatsApp
                    </p>
                    <p className="font-mono text-sm text-text-hi group-hover:text-signal transition-colors">
                      +92 307 202 4974
                    </p>
                  </div>
                  <span className="text-text-mid group-hover:text-signal transition-colors text-base">
                    ↗
                  </span>
                </a>

                <a
                  href="https://www.linkedin.com/in/hammad-afzal-code"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackConversion("linkedin_click")}
                  className="flex items-center justify-between bg-ink-800 border border-ink-600 rounded-card px-5 py-5 hover:border-signal/40 hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div>
                    <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-2">
                      LinkedIn
                    </p>
                    <p className="font-mono text-sm text-text-hi group-hover:text-signal transition-colors">
                      Hammad Afzal
                    </p>
                  </div>
                  <span className="text-text-mid group-hover:text-signal transition-colors text-base">
                    ↗
                  </span>
                </a>

                <a
                  href="/resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackConversion("resume_download")}
                  className="flex items-center justify-between bg-ink-800 border border-ink-600 rounded-card px-5 py-5 hover:border-signal/40 hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div>
                    <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-2">
                      Resume
                    </p>
                    <p className="font-mono text-sm text-text-hi group-hover:text-signal transition-colors">
                      Download PDF
                    </p>
                  </div>
                  <span className="text-text-mid group-hover:text-signal transition-colors text-base">
                    ↓
                  </span>
                </a>
              </div>
            </SectionReveal>

            {/* Terminal quick-note form */}
            <SectionReveal delay={0.15}>
              <div className="border border-ink-600 rounded-card overflow-hidden">
                {/* Terminal chrome header */}
                <div className="flex items-center justify-between px-4 py-3 bg-ink-700 border-b border-line">
                  <div className="flex items-center gap-2">
                    {/* Window dot controls — one lime to brand it */}
                    <span className="w-2.5 h-2.5 rounded-full bg-signal animate-pulse-lime" />
                    <span className="w-2.5 h-2.5 rounded-full bg-ink-600" />
                    <span className="w-2.5 h-2.5 rounded-full bg-ink-600" />
                  </div>
                  <span className="font-mono text-mono-label text-text-lo tracking-widest">
                    <span className="text-signal mr-1.5">&gt;_</span>
                    new_message.txt
                  </span>
                  <span className="font-mono text-[10px] text-text-lo opacity-0 select-none">
                    ···
                  </span>
                </div>

                {/* Form body */}
                <div className="px-6 py-6 bg-ink-800">
                  <AnimatePresence mode="wait">
                    {state === "done" ? (
                      <motion.div
                        key="done"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-3 py-8 text-center"
                      >
                        <motion.span
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 18,
                          }}
                          className="text-3xl"
                        >
                          ✓
                        </motion.span>
                        <p className="font-mono text-mono-label text-ok uppercase tracking-widest">
                          Message received
                        </p>
                        <p className="font-mono text-mono-label text-text-lo">
                          I&apos;ll reply within one business day.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.form
                        key="form"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onSubmit={handleSubmit}
                        className="space-y-4"
                      >
                        {/* Email field */}
                        <div className="relative">
                          <label
                            htmlFor="contact-email"
                            className="block section-index mb-2"
                          >
                            Your email
                          </label>
                          <div className="relative">
                            <input
                              id="contact-email"
                              type="email"
                              required
                              value={from}
                              onChange={(e) => setFrom(e.target.value)}
                              onFocus={() => setFocusedField("email")}
                              onBlur={() => setFocusedField(null)}
                              placeholder="you@example.com"
                              className="w-full bg-ink-900 border border-ink-600 rounded-btn px-4 py-3 text-text-hi font-mono text-small outline-none transition-colors duration-150 placeholder:text-text-lo"
                              style={{
                                borderColor:
                                  focusedField === "email"
                                    ? "rgba(198,255,58,0.5)"
                                    : undefined,
                                boxShadow:
                                  focusedField === "email"
                                    ? "0 0 0 1px rgba(198,255,58,0.15)"
                                    : undefined,
                              }}
                            />
                            {/* Scan line on focus */}
                            <motion.span
                              className="pointer-events-none absolute bottom-0 left-0 h-[2px] bg-signal rounded-b"
                              initial={false}
                              animate={{
                                width: focusedField === "email" ? "100%" : "0%",
                              }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                            />
                          </div>
                        </div>

                        {/* Message field */}
                        <div className="relative">
                          <label
                            htmlFor="contact-message"
                            className="block section-index mb-2"
                          >
                            Message
                          </label>
                          <div className="relative">
                            <textarea
                              ref={messageRef}
                              id="contact-message"
                              rows={4}
                              required
                              maxLength={1000}
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              onFocus={() => setFocusedField("message")}
                              onBlur={() => setFocusedField(null)}
                              placeholder={
                                placeholder +
                                (focusedField !== "message" && message === ""
                                  ? "|"
                                  : "")
                              }
                              className="w-full bg-ink-900 border border-ink-600 rounded-btn px-4 py-3 text-text-hi font-mono text-small outline-none transition-colors duration-150 resize-none placeholder:text-text-lo"
                              style={{
                                borderColor:
                                  focusedField === "message"
                                    ? "rgba(198,255,58,0.5)"
                                    : undefined,
                                boxShadow:
                                  focusedField === "message"
                                    ? "0 0 0 1px rgba(198,255,58,0.15)"
                                    : undefined,
                              }}
                            />
                            <motion.span
                              className="pointer-events-none absolute bottom-0 left-0 h-[2px] bg-signal rounded-b"
                              initial={false}
                              animate={{
                                width:
                                  focusedField === "message" ? "100%" : "0%",
                              }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                            />
                          </div>
                          {message.length > 80 && (
                            <p className="font-mono text-[10px] text-text-lo text-right mt-1 tabular-nums">
                              {message.length} / 1000
                            </p>
                          )}
                        </div>

                        {state === "error" && (
                          <p className="font-mono text-mono-label text-danger">
                            Something went wrong — email directly instead.
                          </p>
                        )}

                        {/* Submit */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                          <p className="font-mono text-[10px] text-text-lo">
                            Typically replied within 1 business day
                          </p>
                          <motion.button
                            type="submit"
                            disabled={state === "sending"}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className="w-full sm:w-auto bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-7 py-3 hover:bg-signal-dim disabled:opacity-50 transition-colors min-w-[120px] flex items-center justify-center gap-2"
                          >
                            {state === "sending" ? <SendingDots /> : "Send →"}
                          </motion.button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </SectionReveal>

            {/* Footer links */}
            <SectionReveal delay={0.2}>
              <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
                <a
                  href="https://github.com/HammadAfzalCode"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-small text-text-mid hover:text-signal transition-colors"
                >
                  GitHub ↗
                </a>
                <span className="text-ink-600">·</span>
                <a
                  href="tel:923072024974"
                  className="font-mono text-small text-text-mid hover:text-signal transition-colors"
                >
                  +92 307 202 4974
                </a>
                <span className="text-ink-600">·</span>
                <span className="font-mono text-small text-text-lo">
                  PKT — UTC+5 · Available across US / EU / UK hours
                </span>
              </div>
            </SectionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
