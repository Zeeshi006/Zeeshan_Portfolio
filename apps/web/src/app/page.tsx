import { Suspense } from "react";
import { apiFetch } from "@/lib/api";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Skills } from "@/components/sections/Skills";
import { Experience } from "@/components/sections/Experience";
import { Projects } from "@/components/sections/Projects";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/Footer";
import { AvailabilityBlock } from "@/components/sections/AvailabilityBlock";
import { GitHub } from "@/components/sections/GitHub";
import { LatestPosts, LatestPostsSkeleton } from "@/components/sections/LatestPosts";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import type { SkillDto, SkillCategoryDto, ExperienceDto, ProjectDto } from "@portfolio/types";

export const revalidate = 60;

type HeroContent = { headline: string; subheadline: string; ctaPrimary: string; ctaPrimaryHref: string; ctaSecondary: string; ctaSecondaryHref: string };
type AboutContent = { narrative: string };

async function safeGet<T>(path: string, fallback: T, tags: string[]): Promise<T> {
  try {
    const result = await apiFetch<T>(path, { next: { tags, revalidate: 60 } } as RequestInit);
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [hero, about, skills, skillCategories, experiences, projects, availability, github] = await Promise.all([
    safeGet<HeroContent>("/content/site/hero", {
      headline: "Hammad Afzal",
      subheadline: "Real-time backends. LLM agents. Systems that work.",
      ctaPrimary: "View Work",
      ctaPrimaryHref: "#projects",
      ctaSecondary: "Get in Touch",
      ctaSecondaryHref: "#contact",
    }, ["hero"]),
    safeGet<AboutContent>("/content/site/about", {
      narrative:
        "I solve hard problems in real-time systems and applied AI. Voice agents that work, knowledge bases that learn, architectures that don't collapse under load. I obsess over the constraints — latency, reliability, cost — because that's where the real engineering lives.",
    }, ["about"]),
    safeGet<SkillDto[]>("/content/skills", [], ["skills"]),
    safeGet<SkillCategoryDto[]>("/content/skill-categories", [], ["skills"]),
    safeGet<ExperienceDto[]>("/content/experiences", [], ["experiences"]),
    safeGet<ProjectDto[]>("/content/projects", [], ["projects"]),
    safeGet<Record<string, unknown>>("/content/site/availability", {
      status: "open", statusLabel: "Open to senior backend / full-stack remote roles",
      location: "Karachi, Pakistan · PKT (UTC+5)",
      hours: "Available across US / EU / UK business hours",
      notice: "Available immediately", response: "Same business day"
    }, ["availability"]),
    safeGet<Record<string, unknown> | null>("/github", null, ["github"]),
  ]);

  return (
    <>
      <AnalyticsProvider />
      {/* Safe-area spacer: keeps SpeedDial pill from covering footer on mobile */}
      <main className="pb-24 xl:pb-0">
        <Hero {...hero} />
        <About narrative={about.narrative} />
        <Skills skills={skills} categoryOrder={skillCategories.map(c => c.name)} />
        <Experience experiences={experiences} />
        <Projects projects={projects} />
        <GitHub data={github as any} />
        <AvailabilityBlock data={availability as any} />
        <Suspense fallback={<LatestPostsSkeleton />}>
          <LatestPosts />
        </Suspense>
        <Contact />
      </main>
      <Footer />
    </>
  );
}
