import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Hammad Afzal — Backend Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#0A0C10",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Subtle grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(#232A36 1px, transparent 1px), linear-gradient(90deg, #232A36 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          opacity: 0.3,
        }}
      />

      {/* Lime accent bar */}
      <div
        style={{
          width: 48,
          height: 3,
          background: "#C6FF3A",
          marginBottom: 40,
        }}
      />

      {/* Name */}
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: "#E8ECF2",
          lineHeight: 1.0,
          letterSpacing: "-0.02em",
          marginBottom: 24,
        }}
      >
        Hammad Afzal
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 28,
          color: "#99A2B2",
          lineHeight: 1.4,
          maxWidth: 700,
        }}
      >
        Real-time backends. LLM agents. Systems that work.
      </div>

      {/* Stack tags */}
      <div style={{ display: "flex", gap: 12, marginTop: 48 }}>
        {["NestJS", "Next.js", "PostgreSQL", "DeepSeek"].map((tag) => (
          <div
            key={tag}
            style={{
              background: "#0F1218",
              border: "1px solid #1E2430",
              borderRadius: 6,
              padding: "6px 16px",
              color: "#5C6573",
              fontSize: 16,
              fontFamily: "monospace",
            }}
          >
            {tag}
          </div>
        ))}
      </div>

      {/* Bottom label */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          right: 80,
          color: "#C6FF3A",
          fontSize: 16,
          fontFamily: "monospace",
          letterSpacing: "0.08em",
        }}
      >
        hammad.cloud
      </div>
    </div>,
    { ...size },
  );
}
