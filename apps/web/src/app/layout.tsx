import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PublicShell } from "@/components/PublicShell";

// Syne ≈ Clash Display feel (geometric, high-contrast display font on Google Fonts)
// Replace with self-hosted Clash Display from fontshare.com when downloaded
const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

// DM Sans ≈ General Sans feel (clean geometric grotesk on Google Fonts)
// Replace with self-hosted General Sans from fontshare.com when downloaded
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"),
  title: { default: "Hammad Afzal — Fullstack Engineer", template: "%s | Hammad Afzal" },
  description:
    "Fullstack + AI engineer building real-time, AI-native systems. NestJS, Next.js, PostgreSQL, RAG pipelines, voice agents.",
  openGraph: {
    title: "Hammad Afzal — Fullstack Engineer",
    description: "Fullstack + AI engineer building real-time, AI-native systems.",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og?type=default", width: 1200, height: 630, alt: "Hammad Afzal — Fullstack Engineer" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og?type=default"],
  },
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/blog/feed.xml", title: "Hammad Afzal — Writing" }],
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-ink-900 text-text-hi font-body antialiased">
        <PublicShell />
        {children}
      </body>
    </html>
  );
}
