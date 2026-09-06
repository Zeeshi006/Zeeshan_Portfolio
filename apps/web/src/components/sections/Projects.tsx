"use client";
import Link from "next/link";
import { SectionReveal, StaggerChildren, StaggerItem } from "@/components/SectionReveal";
import { trackConversion } from "@/lib/analytics";
import type { ProjectDto } from "@portfolio/types";

function ProjectCard({ project }: { project: ProjectDto }) {
  const hasLinks = !!(project.liveUrl || project.githubUrl);
  const isNDA = !hasLinks;

  return (
    // Relative container: full-card Link underneath, interactive elements on top
    <div className="relative group bg-ink-800 border border-ink-600 rounded-card p-6 hover:border-signal/40 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
      {/* Full-card clickable overlay — z-10 so it sits above passive content */}
      <Link
        href={`/projects/${project.slug}`}
        onClick={() => trackConversion("project_click", { slug: project.slug, title: project.title })}
        className="absolute inset-0 rounded-card z-10"
        aria-label={`View ${project.title}`}
      />

      {/* Content layer — z-0 (below the link). External buttons use z-20 to break out */}
      <div className="relative z-0">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
              {project.status === "shipped" ? "Shipped" : project.status === "in_progress" ? "In Progress" : "Archived"}
            </span>
            {project.featured && (
              <span className="font-mono text-mono-label text-signal-dim border border-signal/30 rounded px-1.5 py-0 uppercase tracking-widest">
                Featured
              </span>
            )}
            {isNDA && (
              <span className="font-mono text-mono-label text-text-lo border border-line rounded px-1.5 py-0 uppercase tracking-widest">
                NDA
              </span>
            )}
          </div>
          <span className="font-mono text-mono-label text-signal opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {project.caseStudyPublished ? "READ →" : "VIEW →"}
          </span>
        </div>

        <h3 className="text-h3 font-display text-text-hi mb-2">{project.title}</h3>
        <p className="text-text-mid text-base leading-relaxed mb-4">{project.tagline}</p>

        <p className="font-mono text-small text-signal mb-4 font-medium">{project.outcomeMetric}</p>

        {/* Tech chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {project.techStack.map((tech) => (
            <span
              key={tech}
              className="font-mono text-mono-label text-text-lo bg-ink-900 border border-line rounded px-2 py-0.5"
            >
              {tech}
            </span>
          ))}
        </div>

        {/* External link buttons — z-20 breaks above the z-10 card link */}
        {(hasLinks || project.caseStudyPublished) && (
          <div className="relative z-20 flex flex-wrap gap-2 mt-2">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 bg-signal text-signal-ink rounded hover:bg-signal-dim transition-colors active:scale-[0.98]"
              >
                Live →
              </a>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-ink-600 text-text-hi rounded hover:border-text-lo transition-colors"
              >
                Source →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Projects({ projects }: { projects: ProjectDto[] }) {
  return (
    <section id="projects" className="py-24 md:py-32 border-t border-line overflow-hidden">
      <div id="case-studies" className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[140px_1fr] md:gap-10 md:items-start">
          <div className="hidden md:block">
            <SectionReveal>
              <p className="section-index">03 / PROJECTS</p>
            </SectionReveal>
          </div>

          <div className="space-y-10 min-w-0">
            <SectionReveal>
              <p className="section-index md:hidden mb-2">03 / PROJECTS</p>
              <h2 className="text-display-l font-display text-text-hi">Selected work</h2>
            </SectionReveal>

            <StaggerChildren className="grid sm:grid-cols-2 gap-4">
              {projects.map((project) => (
                <StaggerItem key={project.id}>
                  <ProjectCard project={project} />
                </StaggerItem>
              ))}
              {projects.length === 0 && (
                <p className="col-span-2 text-text-lo font-mono text-mono-label">Projects loading…</p>
              )}
            </StaggerChildren>
          </div>
        </div>
      </div>
    </section>
  );
}
