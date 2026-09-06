// Shared content DTOs — single source of truth for frontend + backend

export interface SkillDto {
  id: string;
  name: string;
  category: SkillCategory;
  proficiencyLevel: number; // 1–5
  featured: boolean;
  sortOrder: number;
}

export type SkillCategory = string;

export interface SkillCategoryDto {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ExperienceDto {
  id: string;
  company: string;
  role: string;
  startDate: string; // ISO date string
  endDate: string | null; // null = present
  summary: string;
  highlights: string[];
  sortOrder: number;
}

export interface ProjectDto {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  techStack: string[];
  outcomeMetric: string; // e.g. "3× faster onboarding"
  status: ProjectStatus;
  featured: boolean;
  sortOrder: number;
  // External links (null = NDA/private)
  liveUrl: string | null;
  githubUrl: string | null;
  videoUrl: string | null;
  // Inline case study
  caseStudyPublished: boolean;
  context: string | null;
  problem: string | null;
  architectureDiagram: string | null;
  diagramImageUrl: string | null;
  keyDecisions: KeyDecision[];
  hardParts: string | null;
  outcome: string | null;
}

export type ProjectStatus = "shipped" | "in_progress" | "archived";

export interface KeyDecision {
  title: string;
  chosen: string;
  alternative: string;
  rationale: string;
}

export interface HeroContentDto {
  headline: string;
  subheadline: string;
  ctaPrimary: string;
  ctaSecondary: string;
}

export interface AboutDto {
  narrative: string;
}
