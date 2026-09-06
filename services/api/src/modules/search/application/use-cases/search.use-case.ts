import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { SearchResultItemDto, SearchResultsDto } from "../../presentation/dtos/search.dto";

@Injectable()
export class SearchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: string, limit = 5): Promise<SearchResultsDto> {
    const term = q.trim();
    if (!term) return { projects: [], skills: [], experiences: [], posts: [], total: 0 };

    const [projects, skills, experiences, posts] = await Promise.all([
      this.searchProjects(term, limit),
      this.searchSkills(term, limit),
      this.searchExperiences(term, limit),
      this.searchPosts(term, limit),
    ]);

    return {
      projects,
      skills,
      experiences,
      posts,
      total: projects.length + skills.length + experiences.length + posts.length,
    };
  }

  private async searchProjects(term: string, limit: number): Promise<SearchResultItemDto[]> {
    const rows = await this.prisma.project.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { tagline: { contains: term, mode: "insensitive" } },
          { outcomeMetric: { contains: term, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => ({
      type: "project" as const,
      id: r.id,
      title: r.title,
      subtitle: r.tagline,
      href: `/projects/${r.slug}`,
      meta: (r.techStack as string[]).slice(0, 3).join(" · "),
    }));
  }

  private async searchSkills(term: string, limit: number): Promise<SearchResultItemDto[]> {
    const rows = await this.prisma.skill.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      take: limit,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => ({
      type: "skill" as const,
      id: r.id,
      title: r.name,
      subtitle: r.category.replace(/_/g, " "),
      href: "/#skills",
      meta: `${r.proficiencyLevel}/5`,
    }));
  }

  private async searchExperiences(term: string, limit: number): Promise<SearchResultItemDto[]> {
    const rows = await this.prisma.experience.findMany({
      where: {
        OR: [
          { company: { contains: term, mode: "insensitive" } },
          { role: { contains: term, mode: "insensitive" } },
          { summary: { contains: term, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => ({
      type: "experience" as const,
      id: r.id,
      title: r.role,
      subtitle: r.company,
      href: "/#experience",
    }));
  }

  private async searchPosts(term: string, limit: number): Promise<SearchResultItemDto[]> {
    const rows = await this.prisma.blogPost.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { excerpt: { contains: term, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { publishedAt: "desc" },
    });
    return rows.map((r) => ({
      type: "post" as const,
      id: r.id,
      title: r.title,
      subtitle: (r.excerpt as string | null) ?? "",
      href: `/blog/${r.slug}`,
      meta: `${r.readingTime as number} min`,
    }));
  }
}
