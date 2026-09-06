import { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hammad.cloud";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getBlogSlugs(): Promise<{ slug: string; updatedAt?: string }[]> {
  try {
    const res = await fetch(`${API}/blog?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data: { slug: string; publishedAt: string | null }[];
    };
    return json.data.map((p) =>
      p.publishedAt
        ? { slug: p.slug, updatedAt: p.publishedAt }
        : { slug: p.slug },
    );
  } catch {
    return [];
  }
}

async function getProjectSlugs(): Promise<
  { slug: string; updatedAt?: string }[]
> {
  try {
    const res = await fetch(`${API}/content/projects`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { slug: string; updatedAt?: string }[];
    return json.map((p) =>
      p.updatedAt ? { slug: p.slug, updatedAt: p.updatedAt } : { slug: p.slug },
    );
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, projects] = await Promise.all([
    getBlogSlugs(),
    getProjectSlugs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE}/system`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${BASE}/projects/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  return [...staticRoutes, ...projectRoutes, ...postRoutes];
}
