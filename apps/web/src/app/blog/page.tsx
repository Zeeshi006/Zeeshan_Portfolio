import { Metadata } from "next";
import Link from "next/link";
import { SectionReveal } from "@/components/SectionReveal";

export const metadata: Metadata = {
  title: "Writing — Hammad Afzal",
  description: "Technical posts on backend architecture, system design, and applied AI.",
};

interface BlogPost {
  id: string; slug: string; title: string; excerpt: string;
  tags: string[]; publishedAt: string | null; readingTime: number; views: number;
}
interface BlogList { data: BlogPost[]; total: number; }

async function getPosts(page = 1, tag?: string): Promise<BlogList> {
  const params = new URLSearchParams({ page: String(page), limit: "12" });
  if (tag) params.set("tag", tag);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${apiUrl}/blog?${params}`, {
      next: { tags: ["blog"], revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { data: [], total: 0 };
    return res.json() as Promise<BlogList>;
  } catch {
    return { data: [], total: 0 };
  }
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const tag = params.tag;
  const { data: posts, total } = await getPosts(page, tag);
  const totalPages = Math.ceil(total / 12);

  return (
    <main className="min-h-screen pt-32 pb-24">
      <div className="max-w-content mx-auto px-6">

        {/* Header */}
        <SectionReveal>
          <div className="mb-16">
            <p className="section-index mb-3">WRITING</p>
            <h1 className="text-display-l font-display text-text-hi">Thinking in systems.</h1>
            <p className="text-text-mid mt-3 max-w-xl">
              Architecture decisions, AI pipelines, and the hard parts nobody blogs about.
            </p>
          </div>
        </SectionReveal>

        {/* Tag filter strip (populated from posts) */}
        {posts.length > 0 && (() => {
          const allTags = Array.from(new Set(posts.flatMap(p => p.tags))).sort();
          return allTags.length > 0 ? (
            <SectionReveal delay={0.05}>
              <div className="flex flex-nowrap overflow-x-auto gap-2 mb-10 pb-1 sm:flex-wrap sm:overflow-x-visible sm:pb-0 no-scrollbar">
                <Link href="/blog"
                  className={`font-mono text-mono-label uppercase tracking-widest px-3 py-1.5 rounded border transition-colors ${
                    !tag ? "bg-signal text-signal-ink border-signal" : "border-ink-600 text-text-lo hover:border-signal hover:text-signal"
                  }`}>
                  All
                </Link>
                {allTags.map(t => (
                  <Link key={t} href={`/blog?tag=${t}`}
                    className={`font-mono text-mono-label uppercase tracking-widest px-3 py-1.5 rounded border transition-colors ${
                      tag === t ? "bg-signal text-signal-ink border-signal" : "border-ink-600 text-text-lo hover:border-signal hover:text-signal"
                    }`}>
                    {t}
                  </Link>
                ))}
              </div>
            </SectionReveal>
          ) : null;
        })()}

        {/* Post grid */}
        {posts.length === 0 ? (
          <SectionReveal>
            <p className="text-text-lo font-mono text-mono-label text-center py-24">No posts yet — check back soon.</p>
          </SectionReveal>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <SectionReveal key={post.slug} delay={i * 0.04}>
                <Link href={`/blog/${post.slug}`}
                  className="group flex flex-col h-full bg-ink-800 border border-ink-600 rounded-card p-6 hover:border-signal/40 hover:-translate-y-1 transition-all duration-200">
                  {/* Tags */}
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.tags.slice(0, 3).map(t => (
                        <span key={t} className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-ink-700 border border-ink-600 rounded text-text-lo">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Title */}
                  <h2 className="text-text-hi font-display text-h3 leading-snug mb-2 group-hover:text-signal transition-colors">
                    {post.title}
                  </h2>
                  {/* Excerpt */}
                  <p className="text-text-mid text-sm leading-relaxed flex-1 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-line">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-mono-label text-text-lo">{post.readingTime} min</span>
                      {post.publishedAt && (
                        <span className="font-mono text-mono-label text-text-lo">
                          {new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-mono-label text-text-lo group-hover:text-signal transition-colors">→</span>
                  </div>
                </Link>
              </SectionReveal>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-12">
            {page > 1 && (
              <Link href={`/blog?page=${page - 1}${tag ? `&tag=${tag}` : ""}`}
                className="font-mono text-mono-label uppercase tracking-widest px-5 py-2 border border-ink-600 rounded-btn text-text-mid hover:border-signal hover:text-signal transition-colors">
                ← Prev
              </Link>
            )}
            <span className="font-mono text-mono-label text-text-lo">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link href={`/blog?page=${page + 1}${tag ? `&tag=${tag}` : ""}`}
                className="font-mono text-mono-label uppercase tracking-widest px-5 py-2 border border-ink-600 rounded-btn text-text-mid hover:border-signal hover:text-signal transition-colors">
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
