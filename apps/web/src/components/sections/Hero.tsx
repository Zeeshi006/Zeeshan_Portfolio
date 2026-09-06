"use client";
import { Component, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { trackConversion } from "@/lib/analytics";

// Kick off the chunk download immediately at module parse time so Three.js
// starts fetching before React hydrates — cuts perceived load by ~300-600ms.
if (typeof window !== "undefined") {
  void import("@/components/3d/HeroScene");
}

const HeroScene = dynamic(() => import("@/components/3d/HeroScene"), {
  ssr: false,
  loading: () => null,
});

// Silent fallback — if WebGL crashes on mobile, grid motif shows instead
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? null : this.props.children; }
}

interface HeroProps {
  headline: string;
  subheadline: string;
  ctaPrimary?: string;
  ctaPrimaryHref?: string;
  ctaSecondary?: string;
  ctaSecondaryHref?: string;
}

const words = (text: string) => text.split(" ");

export function Hero({
  headline,
  subheadline,
  ctaPrimary = "View Work",
  ctaPrimaryHref = "#projects",
  ctaSecondary = "Get in Touch",
  ctaSecondaryHref = "#contact",
}: HeroProps) {
  const reduced = useReducedMotion();

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden w-full max-w-[100vw]">
      {/* Grid motif background */}
      <div className="absolute inset-0 grid-motif pointer-events-none" />

      {/* 3D scene — desktop/tablet only; hidden on mobile for perf */}
      {!reduced && (
        <div className="absolute inset-0 pointer-events-none hidden md:block">
          <SceneBoundary>
            <HeroScene />
          </SceneBoundary>
        </div>
      )}

      {/* pointer-events-none on the container so the wide div doesn't
          swallow hover events over the right side where graph nodes live. */}
      <div className="relative z-10 max-w-content mx-auto px-6 pt-24 pb-16 pointer-events-none">
        {/* Mono index */}
        <motion.p
          className="section-index mb-6"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          Architecture-first engineer
        </motion.p>

        {/* Headline — word-by-word reveal */}
        <h1 className="text-[2rem] sm:text-[3rem] md:text-display-xl font-display text-text-hi leading-none tracking-tight mb-6 max-w-4xl overflow-hidden">
          {words(headline).map((word, i) => (
            <motion.span
              key={i}
              className="inline-block mr-[0.3em]"
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.06, ease: "easeOut" }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          className="text-h3 text-text-mid max-w-xl mb-10"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {subheadline}
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.0 }}
        >
          <a
            href={ctaPrimaryHref}
            onClick={(e) => {
              e.preventDefault();
              trackConversion("cta_click", { cta: ctaPrimaryHref });
              document.getElementById(ctaPrimaryHref.replace("#", ""))?.scrollIntoView({ behavior: "smooth" });
            }}
            className="pointer-events-auto cursor-pointer inline-flex items-center justify-center bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-7 py-3.5 hover:bg-signal-dim active:scale-[0.98] transition-all w-full sm:w-auto"
          >
            {ctaPrimary}
          </a>
          <a
            href={ctaSecondaryHref}
            onClick={(e) => {
              e.preventDefault();
              trackConversion("cta_click", { cta: ctaSecondaryHref });
              document.getElementById(ctaSecondaryHref.replace("#", ""))?.scrollIntoView({ behavior: "smooth" });
            }}
            className="pointer-events-auto cursor-pointer inline-flex items-center justify-center border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-7 py-3.5 hover:border-text-lo active:scale-[0.98] transition-all w-full sm:w-auto"
          >
            {ctaSecondary}
          </a>
        </motion.div>

        {/* Scroll indicator — hidden on mobile */}
        <motion.div
          className="absolute bottom-8 left-6 hidden md:block"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <p className="section-index">Scroll to explore</p>
        </motion.div>
      </div>
    </section>
  );
}
