import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import { Footer } from "@/components/Footer";
import { SectionReveal } from "@/components/SectionReveal";
import type { ProjectDto, KeyDecision } from "@portfolio/types";
import { ReadTracker } from "@/components/ReadTracker";

export const revalidate = 60;

async function getProject(slug: string): Promise<ProjectDto | null> {
  try {
    return await apiFetch<ProjectDto>(`/content/projects/${slug}`, {
      next: { tags: ["projects"] },
    } as RequestInit);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return { title: "Not Found" };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hammad.CLOUD";
  const tags = (project.techStack ?? []).slice(0, 4).join(",");
  const ogUrl = `${site}/og?type=project&title=${encodeURIComponent(project.title)}&tags=${encodeURIComponent(tags)}`;
  return {
    title: project.title,
    description: project.tagline,
    openGraph: {
      title: project.title,
      description: project.tagline,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: project.title }],
    },
    twitter: { card: "summary_large_image", images: [ogUrl] },
  };
}

// ── Chip component ──────────────────────────────────────────────────────────
function TechChip({ label }: { label: string }) {
  return (
    <span className="font-mono text-mono-label text-text-mid bg-ink-900 border border-line rounded px-3 py-1">
      {label}
    </span>
  );
}

// ── Section label ───────────────────────────────────────────────────────────
function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-3">
      <span className="text-signal">{index}</span> / {title}
    </p>
  );
}

// ── Status tag ──────────────────────────────────────────────────────────────
function StatusTag({ status }: { status: ProjectDto["status"] }) {
  const label =
    status === "shipped"
      ? "Shipped"
      : status === "in_progress"
        ? "In Progress"
        : "Archived";
  return (
    <span className="font-mono text-mono-label text-text-lo border border-ink-600 rounded px-2 py-0.5 uppercase tracking-widest">
      {label}
    </span>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const isNDA = !project.liveUrl && !project.githubUrl;
  const hasCaseStudy = project.caseStudyPublished;

  // Auto-number the case study content sections
  let sectionIdx = 0;
  const nextIdx = () => String(++sectionIdx).padStart(2, "0");

  return (
    <>
      <main className="pt-24 pb-32">
        <div className="max-w-[800px] mx-auto px-6">
          {/* ── 1. Header ─────────────────────────────────────────────────── */}
          <SectionReveal>
            <div className="mb-10">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <StatusTag status={project.status} />
                {isNDA && (
                  <span className="font-mono text-mono-label text-text-lo border border-line rounded px-2 py-0.5 uppercase tracking-widest">
                    NDA · Private Work
                  </span>
                )}
              </div>

              <h1 className="text-display-l font-display text-text-hi mb-3 leading-tight">
                {project.title}
              </h1>
              <p className="text-text-mid text-h3 font-body leading-snug mb-4">
                {project.tagline}
              </p>
              {project.outcomeMetric && (
                <p className="font-mono text-mono-label text-signal">
                  {project.outcomeMetric}
                </p>
              )}
            </div>
          </SectionReveal>

          {/* ── 2. Links row ──────────────────────────────────────────────── */}
          {(project.liveUrl || project.githubUrl || project.videoUrl) && (
            <SectionReveal delay={0.05}>
              <div className="flex flex-wrap gap-3 mb-12">
                {project.liveUrl && (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest px-4 py-2 rounded hover:bg-signal-dim transition-colors active:scale-[0.98]"
                  >
                    Visit Live →
                  </a>
                )}
                {project.githubUrl && (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-transparent border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest px-4 py-2 rounded hover:border-text-lo transition-colors"
                  >
                    View Source
                  </a>
                )}
                {project.videoUrl && (
                  <a
                    href={project.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-transparent border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest px-4 py-2 rounded hover:border-text-lo transition-colors"
                  >
                    Watch Demo
                  </a>
                )}
              </div>
            </SectionReveal>
          )}

          {/* ── Case study content (only when published) ──────────────────── */}
          {hasCaseStudy && (
            <>
              {project.context && (
                <SectionReveal delay={0.1}>
                  <div className="mb-12">
                    <SectionLabel index={nextIdx()} title="Context" />
                    <p className="text-text-mid leading-[1.7]">
                      {project.context}
                    </p>
                  </div>
                </SectionReveal>
              )}

              {project.problem && (
                <SectionReveal delay={0.1}>
                  <div className="mb-12">
                    <SectionLabel index={nextIdx()} title="The Problem" />
                    <p className="text-text-mid leading-[1.7] whitespace-pre-wrap">
                      {project.problem}
                    </p>
                  </div>
                </SectionReveal>
              )}

              {project.architectureDiagram && (
                <SectionReveal delay={0.1}>
                  <div className="mb-12">
                    <SectionLabel index={nextIdx()} title="Architecture" />
                    <div className="bg-ink-800 border border-ink-600 rounded-card p-6 overflow-x-auto">
                      <pre className="font-mono text-small text-text-mid whitespace-pre leading-relaxed">
                        {project.architectureDiagram}
                      </pre>
                    </div>
                  </div>
                </SectionReveal>
              )}

              {project.keyDecisions && project.keyDecisions.length > 0 && (
                <SectionReveal delay={0.1}>
                  <div className="mb-12">
                    <SectionLabel
                      index={nextIdx()}
                      title="Key Decisions & Tradeoffs"
                    />
                    <div className="space-y-4">
                      {project.keyDecisions.map(
                        (decision: KeyDecision, i: number) => (
                          <div
                            key={i}
                            className="bg-ink-800 border border-ink-600 rounded-card p-6"
                          >
                            <h3 className="font-display text-text-hi text-h3 mb-3">
                              {decision.title}
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-4 mb-3">
                              <div>
                                <p className="font-mono text-mono-label text-signal uppercase tracking-widest mb-1">
                                  Chosen
                                </p>
                                <p className="text-text-mid text-small leading-[1.7]">
                                  {decision.chosen}
                                </p>
                              </div>
                              <div>
                                <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">
                                  Alternative
                                </p>
                                <p className="text-text-mid text-small leading-[1.7]">
                                  {decision.alternative}
                                </p>
                              </div>
                            </div>
                            <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">
                              Rationale
                            </p>
                            <p className="text-text-mid text-small leading-[1.7]">
                              {decision.rationale}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </SectionReveal>
              )}

              {project.hardParts && (
                <SectionReveal delay={0.1}>
                  <div className="mb-12">
                    <SectionLabel index={nextIdx()} title="Hard Parts" />
                    <p className="text-text-mid leading-[1.7] whitespace-pre-wrap">
                      {project.hardParts}
                    </p>
                  </div>
                </SectionReveal>
              )}

              {project.outcome && (
                <SectionReveal delay={0.1}>
                  <div className="mb-12">
                    <SectionLabel index={nextIdx()} title="Outcome" />
                    <p className="text-text-mid leading-[1.7] whitespace-pre-wrap">
                      {project.outcome}
                    </p>
                  </div>
                </SectionReveal>
              )}
            </>
          )}

          {/* ── Tech Stack (always shown) ──────────────────────────────────── */}
          <SectionReveal delay={0.1}>
            <div className="bg-ink-800 border border-ink-600 rounded-card p-6 mb-12">
              <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">
                Tech Stack
              </p>
              <div className="flex flex-wrap gap-2">
                {project.techStack.map((tech) => (
                  <TechChip key={tech} label={tech} />
                ))}
              </div>
            </div>
          </SectionReveal>

          {/* ── NDA note ──────────────────────────────────────────────────── */}
          {isNDA && (
            <SectionReveal delay={0.15}>
              <p className="font-mono text-mono-label text-text-lo border-t border-line pt-6">
                Full walkthrough available on request —{" "}
                <Link
                  href="/#contact"
                  className="text-signal hover:text-signal-dim transition-colors"
                >
                  reach out
                </Link>
                .
              </p>
            </SectionReveal>
          )}
        </div>
      </main>
      <Footer />
      <ReadTracker slug={slug} />
    </>
  );
}
