import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const fontData = await readFile(
    path.join(process.cwd(), "public", "fonts", "JetBrainsMono-Medium.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0C10",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "1px",
            borderRadius: "5px",
            border: "1px solid rgba(198,255,58,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: "#C6FF3A",
              fontSize: "13px",
              fontWeight: "500",
              fontFamily: "JetBrains Mono",
              letterSpacing: "-0.5px",
              lineHeight: 1,
            }}
          >
            HA
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "JetBrains Mono", data: fontData, style: "normal", weight: 500 }],
    },
  );
}
