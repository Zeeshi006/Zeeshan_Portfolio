import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Fetch project data
  let title = "Project";
  let tagline = "Hammad Afzal — Backend Engineer";
  try {
    const res = await fetch(
      `${process.env["API_URL"] ?? "http://localhost:3001"}/content/projects/${slug}`,
    );
    if (res.ok) {
      const p = await res.json();
      title = p.title ?? title;
      tagline = p.tagline ?? tagline;
    }
  } catch {}

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
      <div
        style={{
          fontSize: 18,
          color: "#5C6573",
          fontFamily: "monospace",
          letterSpacing: "0.1em",
          marginBottom: 24,
          textTransform: "uppercase",
        }}
      >
        Case Study
      </div>
      <div
        style={{
          width: 48,
          height: 3,
          background: "#C6FF3A",
          marginBottom: 32,
        }}
      />
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: "#E8ECF2",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          marginBottom: 24,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 24,
          color: "#99A2B2",
          lineHeight: 1.5,
          maxWidth: 720,
        }}
      >
        {tagline}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 80,
          color: "#99A2B2",
          fontSize: 16,
          fontFamily: "monospace",
        }}
      >
        Hammad Afzal
      </div>
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
