"use client";

import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-mono text-mono-label uppercase tracking-widest rounded-btn transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal px-6 py-3 cursor-pointer disabled:opacity-40";

  const variants = {
    primary:
      "bg-signal text-signal-ink hover:bg-signal-dim",
    secondary:
      "bg-transparent border border-ink-600 text-text-hi hover:border-text-lo",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
