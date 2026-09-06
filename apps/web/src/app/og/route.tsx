import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readFont(filename: string): ArrayBuffer | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeFs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require("path") as typeof import("path");
    const buf = nodeFs.readFileSync(
      nodePath.join(process.cwd(), "public", "fonts", filename),
    );
    return buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

const INK900 = "#0A0C10";
const INK800 = "#0F1218";
const LINE   = "#232A36";
const TEXTHI = "#E8ECF2";
const TEXTMID = "#99A2B2";
const TEXTLO = "#5C6573";
const SIGNAL = "#C6FF3A";

export function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const type = (searchParams.get("type") ?? "default") as
      | "post"
      | "project"
      | "default";
    const title =
      searchParams.get("title") ?? "Hammad Afzal — Fullstack Engineer";
    const rawTags = searchParams.get("tags") ?? "";
    const date = searchParams.get("date") ?? "";

    const tags = rawTags
      ? rawTags
          .split(",")
          .slice(0, 4)
          .map((t) => t.trim())
      : [];
    const truncTitle = title.length > 65 ? title.slice(0, 62) + "…" : title;
    const titleSize = title.length > 60 ? 46 : title.length > 40 ? 56 : 68;
    const typeLabel =
      type === "post"
        ? "// WRITING"
        : type === "project"
          ? "// PROJECT"
          : "// PORTFOLIO";

    const chipTags =
      tags.length > 0 ? tags : ["NestJS", "Next.js", "PostgreSQL", "AI"];

    const syneBuf = readFont("Syne-Bold.woff");
    const jbBuf = readFont("JetBrainsMono-Medium.ttf");
    const fonts: {
      name: string;
      data: ArrayBuffer;
      weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    }[] = [];
    if (syneBuf) fonts.push({ name: "Syne", data: syneBuf, weight: 700 });
    if (jbBuf) fonts.push({ name: "JetBrains Mono", data: jbBuf, weight: 500 });

    const mono = jbBuf ? "JetBrains Mono, monospace" : "monospace";
    const disp = syneBuf ? "Syne, sans-serif" : "sans-serif";

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          background: INK900,
        }}
      >
        {/* ── 6px lime left accent bar ── */}
        <div
          style={{
            width: "6px",
            height: "630px",
            background: SIGNAL,
            flexShrink: 0,
          }}
        />

        {/* ── Main content panel ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "52px 64px 52px 60px",
            backgroundImage: `linear-gradient(${LINE}26 1px, transparent 1px), linear-gradient(90deg, ${LINE}26 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        >
          {/* ── Top row: identity + type label ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Left: HA monogram + divider + name */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  fontFamily: disp,
                  fontSize: "36px",
                  fontWeight: 700,
                  color: SIGNAL,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                HA
              </div>
              <div
                style={{
                  width: "1px",
                  height: "26px",
                  background: LINE,
                }}
              />
              <div
                style={{
                  fontFamily: mono,
                  fontSize: "13px",
                  fontWeight: 500,
                  color: TEXTMID,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Hammad Afzal
              </div>
            </div>

            {/* Right: type label with lime dot */}
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: SIGNAL,
                }}
              />
              <div
                style={{
                  fontFamily: mono,
                  fontSize: "12px",
                  fontWeight: 500,
                  color: SIGNAL,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                }}
              >
                {typeLabel}
              </div>
            </div>
          </div>

          {/* ── Title — dominant centre ── */}
          <div
            style={{
              fontFamily: disp,
              fontSize: `${titleSize}px`,
              fontWeight: 700,
              color: TEXTHI,
              letterSpacing: "-0.025em",
              lineHeight: 1.06,
              maxWidth: "980px",
            }}
          >
            {truncTitle}
          </div>

          {/* ── Bottom row: tech chips + URL ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Tech chips — bigger, readable */}
            <div style={{ display: "flex", gap: "8px" }}>
              {chipTags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    fontFamily: mono,
                    fontSize: "12px",
                    fontWeight: 500,
                    color: TEXTMID,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    background: INK800,
                    border: `1px solid ${LINE}`,
                    borderRadius: "4px",
                    padding: "7px 16px",
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>

            {/* URL + optional date */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "5px",
              }}
            >
              <div
                style={{
                  fontFamily: mono,
                  fontSize: "14px",
                  fontWeight: 500,
                  color: TEXTHI,
                  letterSpacing: "0.05em",
                  opacity: 0.5,
                }}
              >
                hammad.cloud
              </div>
              {date ? (
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: "11px",
                    color: TEXTLO,
                    letterSpacing: "0.06em",
                  }}
                >
                  {date}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>,
      { width: 1200, height: 630, fonts },
    );
  } catch (err) {
    console.error("[og] render error:", err);
    return new Response("OG image render failed", { status: 500 });
  }
}
