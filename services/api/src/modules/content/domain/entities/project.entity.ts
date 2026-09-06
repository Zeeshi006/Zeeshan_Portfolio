export type ProjectStatus = "shipped" | "in_progress" | "archived";

export interface KeyDecision {
  title: string;
  chosen: string;
  alternative: string;
  rationale: string;
}

export class Project {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly slug: string,
    public readonly tagline: string,
    public readonly techStack: string[],
    public readonly outcomeMetric: string,
    public readonly status: ProjectStatus,
    public readonly featured: boolean,
    public readonly sortOrder: number,
    public readonly liveUrl: string | null,
    public readonly githubUrl: string | null,
    public readonly videoUrl: string | null,
    public readonly caseStudyPublished: boolean,
    public readonly context: string | null,
    public readonly problem: string | null,
    public readonly architectureDiagram: string | null,
    public readonly diagramImageUrl: string | null,
    public readonly keyDecisions: KeyDecision[],
    public readonly hardParts: string | null,
    public readonly outcome: string | null,
  ) {}
}
