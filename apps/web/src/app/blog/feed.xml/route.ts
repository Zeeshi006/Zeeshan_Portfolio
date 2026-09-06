import { NextResponse } from "next/server";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hammad.cloud";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  publishedAt: string | null;
  readingTime: number;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  let posts: PostSummary[] = [];
  try {
    const res = await fetch(`${API}/blog?limit=50`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = (await res.json()) as { data: PostSummary[] };
      posts = json.data;
    }
  } catch {
    /* serve empty feed */
  }

  const items = posts
    .map((p) => {
      const url = `${BASE}/blog/${p.slug}`;
      const pubDate = p.publishedAt
        ? new Date(p.publishedAt).toUTCString()
        : new Date().toUTCString();
      const categories = p.tags
        .map((t) => `<category>${escapeXml(t)}</category>`)
        .join("");
      return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(p.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
      ${categories}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Hammad Afzal — Writing</title>
    <link>${BASE}/blog</link>
    <description>Technical posts on backend architecture, system design, and applied AI.</description>
    <language>en-GB</language>
    <atom:link href="${BASE}/blog/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
