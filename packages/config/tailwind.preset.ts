import type { Config } from "tailwindcss";

export const tailwindPreset: Partial<Config> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Ink palette — "Terminal Observatory"
        ink: {
          900: "#0A0C10",
          800: "#0F1218",
          700: "#161A22",
          600: "#1E2430",
        },
        line: "#232A36",
        // Text
        "text-hi": "#E8ECF2",
        "text-mid": "#99A2B2",
        "text-lo": "#5C6573",
        // Accent — signal-lime (use sparingly: ≤5% of viewport)
        signal: {
          DEFAULT: "#C6FF3A",
          dim: "#8FB82A",
          ink: "#14210A",
        },
        // System status
        warn: "#FFB020",
        ok: "#3FB950",
        danger: "#F85149",
      },
      fontFamily: {
        display: ["Clash Display", "General Sans", "Satoshi", "sans-serif"],
        body: ["General Sans", "Satoshi", "sans-serif"],
        mono: ["JetBrains Mono", "Geist Mono", "monospace"],
      },
      fontSize: {
        "display-xl": ["4.5rem", { lineHeight: "1.0", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-l":  ["3.0rem", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "600" }],
        "h2":         ["1.75rem", { lineHeight: "1.2" }],
        "h3":         ["1.25rem", { lineHeight: "1.3" }],
        "body":       ["1.0rem", { lineHeight: "1.7" }],
        "small":      ["0.875rem", { lineHeight: "1.5" }],
        "mono-label": ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.08em" }],
      },
      spacing: {
        // 8px-based scale — use ONLY these values
        "0.5": "4px",
        "1":   "8px",
        "1.5": "12px",
        "2":   "16px",
        "3":   "24px",
        "4":   "32px",
        "6":   "48px",
        "8":   "64px",
        "12":  "96px",
        "16":  "128px",
      },
      maxWidth: {
        content: "1200px",
      },
      borderRadius: {
        card: "12px",
        btn: "6px",
      },
      keyframes: {
        pulse_lime: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "pulse-lime": "pulse_lime 2s ease-in-out infinite",
      },
    },
  },
};
