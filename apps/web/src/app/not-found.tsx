import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Page Not Found",
};

export default function NotFound() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Faint grid background */}
      <div className="absolute inset-0 grid-motif pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Section index */}
        <p className="section-index mb-8 tracking-[0.2em]">ERROR / 404</p>

        {/* Giant 404 — decorative, low opacity */}
        <p
          className="font-mono font-bold leading-none tabular-nums select-none pointer-events-none mb-0"
          style={{
            fontSize: "clamp(6rem, 20vw, 14rem)",
            color: "var(--signal)",
            opacity: 0.07,
            letterSpacing: "-0.04em",
            position: "absolute",
            top: "50%",
            transform: "translateY(-58%)",
          }}
          aria-hidden="true"
        >
          404
        </p>

        {/* Heading */}
        <h1 className="text-display-l font-display text-text-hi leading-tight mb-4 mt-2">
          Page not found
        </h1>

        <p className="text-text-mid text-base leading-relaxed max-w-sm mb-10">
          This page doesn&apos;t exist or was moved. Head back and keep exploring.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-7 py-3.5 hover:bg-signal-dim active:scale-[0.98] transition-all"
          >
            ← Back to home
          </Link>
          <Link
            href="/#contact"
            className="inline-flex items-center justify-center border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-7 py-3.5 hover:border-text-lo active:scale-[0.98] transition-all"
          >
            Contact me
          </Link>
        </div>

        {/* Mono footer note */}
        <p className="font-mono text-mono-label text-text-lo mt-12">
          If you followed a link here, it may be broken.
        </p>
      </div>
    </main>
  );
}
