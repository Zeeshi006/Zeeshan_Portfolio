import { cache } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  readingTime: number;
  views: number;
  canonicalUrl: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const getPost = cache(async (slug: string): Promise<BlogPost | null> => {
  try {
    const res = await fetch(`${API}/blog/${slug}`, {
      next: { tags: [`blog-${slug}`], revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json() as Promise<BlogPost>;
  } catch {
    return null;
  }
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hammad.cloud";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  const url = `${SITE}/blog/${slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: post.canonicalUrl ?? url,
    },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt ?? undefined,
      authors: ["Hammad Afzal"],
      tags: post.tags,
      images: [
        {
          url: `${SITE}/og?type=post&title=${encodeURIComponent(post.title)}&tags=${encodeURIComponent(post.tags.slice(0, 4).join(","))}&date=${encodeURIComponent(post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "")}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [
        `${SITE}/og?type=post&title=${encodeURIComponent(post.title)}&tags=${encodeURIComponent(post.tags.slice(0, 4).join(","))}`,
      ],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: { "@type": "Person", name: "Hammad Afzal", url: SITE },
    datePublished: post.publishedAt,
    url: `${SITE}/blog/${slug}`,
    ...(post.canonicalUrl && { sameAs: post.canonicalUrl }),
    keywords: post.tags.join(", "),
  };

  return (
    <main className="min-h-screen pt-32 pb-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/\//g, "\\u002f"),
        }}
      />
      <div className="max-w-[720px] mx-auto px-6">
        {/* Back */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 font-mono text-mono-label text-text-lo hover:text-signal transition-colors mb-10"
        >
          ← All posts
        </Link>

        {/* Header */}
        <header className="mb-10">
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.tags.map((t) => (
                <Link
                  key={t}
                  href={`/blog?tag=${t}`}
                  className="font-mono text-mono-label uppercase tracking-widest px-2.5 py-1 bg-ink-800 border border-ink-600 rounded text-text-lo hover:border-signal hover:text-signal transition-colors"
                >
                  {t}
                </Link>
              ))}
            </div>
          )}
          <h1 className="text-display-l font-display text-text-hi leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-text-mid text-base leading-relaxed mb-5">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-4 pb-6 border-b border-line">
            <span className="font-mono text-mono-label text-text-lo">
              {post.readingTime} min read
            </span>
            {post.publishedAt && (
              <span className="font-mono text-mono-label text-text-lo">
                {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
            <span className="font-mono text-mono-label text-text-lo">
              {post.views} views
            </span>
            {post.canonicalUrl && (
              <a
                href={post.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-mono-label text-signal hover:text-signal-dim transition-colors ml-auto"
              >
                Originally on LinkedIn ↗
              </a>
            )}
          </div>
        </header>

        {/* Body */}
        <article className="prose-blog">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-display-l font-display text-text-hi mt-10 mb-4">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-h2 font-display text-text-hi mt-10 mb-4 pb-2 border-b border-line">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-h3 font-display text-text-hi mt-8 mb-3">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-text-mid text-base leading-[1.75] mb-4">
                  {children}
                </p>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-signal hover:text-signal-dim underline underline-offset-2 transition-colors"
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => (
                <ul className="list-none space-y-1.5 mb-4 pl-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1.5 mb-4 text-text-mid">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-text-mid text-base leading-relaxed flex gap-2">
                  <span className="text-signal flex-shrink-0 mt-0.5">–</span>
                  <span>{children}</span>
                </li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-signal pl-4 my-6 text-text-lo italic">
                  {children}
                </blockquote>
              ),
              code: ({ className, children, ...props }) => {
                const isBlock = className?.includes("language-");
                if (isBlock) {
                  return (
                    <code
                      className={`block bg-ink-700 border border-ink-600 rounded-lg px-5 py-4 font-mono text-sm text-text-hi overflow-x-auto my-5 ${className ?? ""}`}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <code
                    className="font-mono text-sm bg-ink-700 border border-ink-600 rounded px-1.5 py-0.5 text-signal"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="not-prose">{children}</pre>
              ),
              hr: () => <hr className="border-line my-10" />,
              strong: ({ children }) => (
                <strong className="text-text-hi font-semibold">
                  {children}
                </strong>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-6">
                  <table className="w-full border-collapse font-mono text-sm">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-ink-600 px-4 py-2 text-left text-text-lo uppercase tracking-widest text-[10px] bg-ink-700">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-ink-600 px-4 py-2 text-text-mid">
                  {children}
                </td>
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </article>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-line">
          <div className="flex items-center justify-between">
            <Link
              href="/blog"
              className="font-mono text-mono-label text-text-lo hover:text-signal transition-colors"
            >
              ← All posts
            </Link>
            <Link
              href="/#contact"
              className="font-mono text-mono-label uppercase tracking-widest px-5 py-2.5 bg-signal text-signal-ink rounded-btn hover:bg-signal-dim active:scale-[.98] transition-all"
            >
              Hire me →
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
