import Link from "next/link";
import { SectionReveal } from "@/components/SectionReveal";
import { Sk } from "@/components/Skeleton";

export function LatestPostsSkeleton() {
  return (
    <section className="py-24 md:py-32 border-t border-line" aria-hidden="true">
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[140px_1fr] md:gap-10">
          <div className="hidden md:block">
            <Sk className="h-3 w-16" />
          </div>
          <div className="min-w-0">
            <div className="flex items-end justify-between mb-8">
              <Sk className="h-10 w-44" />
              <Sk className="h-3 w-20" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-ink-800 border border-ink-600 rounded-card px-6 py-5">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1.5 mb-2">
                        <Sk className="h-5 w-16" />
                        <Sk className="h-5 w-14" />
                      </div>
                      <Sk className="h-6 w-3/4 mb-2" />
                      <Sk className="h-4 w-full mb-1" />
                      <Sk className="h-4 w-4/5" />
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Sk className="h-3 w-12" />
                      <Sk className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface PostSummary {
  slug: string; title: string; excerpt: string;
  tags: string[]; publishedAt: string | null; readingTime: number;
}

async function getLatestPosts(): Promise<PostSummary[]> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${api}/blog?limit=3`, {
      next: { tags: ["blog"], revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { data: PostSummary[] };
    return data.data;
  } catch { return []; }
}

export async function LatestPosts() {
  const posts = await getLatestPosts();
  if (posts.length === 0) return null;

  return (
    <section className="py-24 md:py-32 border-t border-line overflow-hidden">
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[140px_1fr] md:gap-10">

          <div className="hidden md:block">
            <SectionReveal>
              <p className="section-index">WRITING</p>
            </SectionReveal>
          </div>

          <div className="min-w-0">
            <SectionReveal>
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="section-index md:hidden mb-2">WRITING</p>
                  <h2 className="text-display-l font-display text-text-hi">Latest posts</h2>
                </div>
                <Link href="/blog"
                  className="font-mono text-mono-label uppercase tracking-widest text-text-lo hover:text-signal transition-colors flex-shrink-0">
                  All posts →
                </Link>
              </div>
            </SectionReveal>

            <div className="space-y-3">
              {posts.map((post, i) => (
                <SectionReveal key={post.slug} delay={i * 0.06}>
                  <Link href={`/blog/${post.slug}`}
                    className="group flex items-start justify-between gap-6 bg-ink-800 border border-ink-600 rounded-card px-6 py-5 hover:border-signal/40 hover:-translate-y-0.5 transition-all duration-200">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {post.tags.slice(0, 2).map(t => (
                          <span key={t} className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-ink-700 border border-ink-600 rounded text-text-lo">
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="text-text-hi font-display text-h3 leading-snug group-hover:text-signal transition-colors truncate">
                        {post.title}
                      </p>
                      <p className="text-text-lo text-sm mt-1 line-clamp-2">{post.excerpt}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="font-mono text-mono-label text-text-lo">{post.readingTime} min</span>
                      {post.publishedAt && (
                        <span className="font-mono text-mono-label text-text-lo">
                          {new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      <span className="text-text-lo group-hover:text-signal transition-colors text-sm mt-1">→</span>
                    </div>
                  </Link>
                </SectionReveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
