import { SearchUseCase } from "./search.use-case";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<{
  id: string; title: string; slug: string; tagline: string;
  techStack: string[]; outcomeMetric: string; sortOrder: number;
}> = {}) {
  return {
    id: "proj-1", title: "Portfolio Platform", slug: "portfolio",
    tagline: "NestJS + Next.js portfolio with AI chatbot",
    techStack: ["NestJS", "Next.js", "TypeScript"],
    outcomeMetric: "Shipped in 4 weeks",
    sortOrder: 1,
    ...overrides,
  };
}

function makeSkill(overrides: Partial<{
  id: string; name: string; category: string; proficiencyLevel: number; sortOrder: number;
}> = {}) {
  return { id: "skill-1", name: "TypeScript", category: "backend", proficiencyLevel: 5, sortOrder: 1, ...overrides };
}

function makeExperience(overrides: Partial<{
  id: string; company: string; role: string; summary: string; sortOrder: number;
}> = {}) {
  return {
    id: "exp-1", company: "Acme Corp", role: "Senior Backend Engineer",
    summary: "Built distributed systems at scale.", sortOrder: 1,
    ...overrides,
  };
}

function makePost(overrides: Partial<{
  id: string; title: string; slug: string; excerpt: string;
  published: boolean; readingTime: number; publishedAt: Date;
}> = {}) {
  return {
    id: "post-1", title: "Stop Using any in TypeScript",
    slug: "stop-using-any", excerpt: "Why strict TypeScript matters.",
    published: true, readingTime: 4, publishedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makePrisma(overrides: {
  project?: object[]; skill?: object[]; experience?: object[]; blogPost?: object[];
} = {}) {
  return {
    project: { findMany: jest.fn().mockResolvedValue(overrides.project ?? []) },
    skill:   { findMany: jest.fn().mockResolvedValue(overrides.skill ?? []) },
    experience: { findMany: jest.fn().mockResolvedValue(overrides.experience ?? []) },
    blogPost:   { findMany: jest.fn().mockResolvedValue(overrides.blogPost ?? []) },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SearchUseCase", () => {
  describe("empty / blank query", () => {
    it("returns all-empty result without querying the DB", async () => {
      const prisma = makePrisma();
      const useCase = new SearchUseCase(prisma as never);
      const result = await useCase.execute("   ");
      expect(result).toEqual({ projects: [], skills: [], experiences: [], posts: [], total: 0 });
      expect(prisma.project.findMany).not.toHaveBeenCalled();
    });

    it("handles zero-length string", async () => {
      const prisma = makePrisma();
      const useCase = new SearchUseCase(prisma as never);
      const result = await useCase.execute("");
      expect(result.total).toBe(0);
    });
  });

  describe("project results", () => {
    it("maps project fields to SearchResultItemDto correctly", async () => {
      const proj = makeProject();
      const prisma = makePrisma({ project: [proj] });
      const useCase = new SearchUseCase(prisma as never);
      const { projects } = await useCase.execute("portfolio");

      expect(projects).toHaveLength(1);
      const item = projects[0];
      expect(item.type).toBe("project");
      expect(item.id).toBe(proj.id);
      expect(item.title).toBe(proj.title);
      expect(item.subtitle).toBe(proj.tagline);
      expect(item.href).toBe(`/projects/${proj.slug}`);
      expect(item.meta).toBe("NestJS · Next.js · TypeScript");
    });

    it("truncates techStack meta to first 3 items", async () => {
      const proj = makeProject({ techStack: ["A", "B", "C", "D", "E"] });
      const prisma = makePrisma({ project: [proj] });
      const useCase = new SearchUseCase(prisma as never);
      const { projects } = await useCase.execute("x");
      expect(projects[0].meta).toBe("A · B · C");
    });
  });

  describe("skill results", () => {
    it("maps skill fields correctly", async () => {
      const skill = makeSkill();
      const prisma = makePrisma({ skill: [skill] });
      const useCase = new SearchUseCase(prisma as never);
      const { skills } = await useCase.execute("typescript");

      expect(skills).toHaveLength(1);
      const item = skills[0];
      expect(item.type).toBe("skill");
      expect(item.title).toBe("TypeScript");
      expect(item.subtitle).toBe("backend");
      expect(item.href).toBe("/#skills");
      expect(item.meta).toBe("5/5");
    });

    it("replaces underscores in category with spaces", async () => {
      const skill = makeSkill({ category: "ai_agents" });
      const prisma = makePrisma({ skill: [skill] });
      const useCase = new SearchUseCase(prisma as never);
      const { skills } = await useCase.execute("x");
      expect(skills[0].subtitle).toBe("ai agents");
    });
  });

  describe("experience results", () => {
    it("maps experience fields correctly", async () => {
      const exp = makeExperience();
      const prisma = makePrisma({ experience: [exp] });
      const useCase = new SearchUseCase(prisma as never);
      const { experiences } = await useCase.execute("backend");

      expect(experiences).toHaveLength(1);
      const item = experiences[0];
      expect(item.type).toBe("experience");
      expect(item.title).toBe(exp.role);
      expect(item.subtitle).toBe(exp.company);
      expect(item.href).toBe("/#experience");
    });
  });

  describe("blog post results", () => {
    it("maps blog post fields correctly", async () => {
      const post = makePost();
      const prisma = makePrisma({ blogPost: [post] });
      const useCase = new SearchUseCase(prisma as never);
      const { posts } = await useCase.execute("typescript");

      expect(posts).toHaveLength(1);
      const item = posts[0];
      expect(item.type).toBe("post");
      expect(item.title).toBe(post.title);
      expect(item.subtitle).toBe(post.excerpt);
      expect(item.href).toBe(`/blog/${post.slug}`);
      expect(item.meta).toBe("4 min");
    });

    it("handles null excerpt gracefully", async () => {
      const post = makePost({ excerpt: undefined as unknown as string });
      const prisma = makePrisma({ blogPost: [{ ...post, excerpt: null }] });
      const useCase = new SearchUseCase(prisma as never);
      const { posts } = await useCase.execute("x");
      expect(posts[0].subtitle).toBe("");
    });
  });

  describe("total count", () => {
    it("sums results across all entity types", async () => {
      const prisma = makePrisma({
        project: [makeProject()],
        skill: [makeSkill()],
        experience: [makeExperience()],
        blogPost: [makePost()],
      });
      const useCase = new SearchUseCase(prisma as never);
      const { total } = await useCase.execute("test");
      expect(total).toBe(4);
    });

    it("is 0 when no results found", async () => {
      const prisma = makePrisma();
      const useCase = new SearchUseCase(prisma as never);
      const { total } = await useCase.execute("xyznotfound");
      expect(total).toBe(0);
    });
  });

  describe("limit parameter", () => {
    it("passes limit to each Prisma query", async () => {
      const prisma = makePrisma();
      const useCase = new SearchUseCase(prisma as never);
      await useCase.execute("test", 3);

      for (const model of [prisma.project, prisma.skill, prisma.experience, prisma.blogPost]) {
        expect(model.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 3 }),
        );
      }
    });

    it("defaults to limit 5 when not provided", async () => {
      const prisma = makePrisma();
      const useCase = new SearchUseCase(prisma as never);
      await useCase.execute("test");

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe("parallel execution", () => {
    it("queries all entity types concurrently", async () => {
      const callOrder: string[] = [];
      const prisma = {
        project:    { findMany: jest.fn().mockImplementation(async () => { callOrder.push("project"); return []; }) },
        skill:      { findMany: jest.fn().mockImplementation(async () => { callOrder.push("skill"); return []; }) },
        experience: { findMany: jest.fn().mockImplementation(async () => { callOrder.push("exp"); return []; }) },
        blogPost:   { findMany: jest.fn().mockImplementation(async () => { callOrder.push("post"); return []; }) },
      };
      const useCase = new SearchUseCase(prisma as never);
      await useCase.execute("test");
      // All 4 should have been called (order may vary with Promise.all)
      expect(callOrder).toHaveLength(4);
      expect(callOrder).toEqual(expect.arrayContaining(["project", "skill", "exp", "post"]));
    });
  });
});
