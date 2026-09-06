import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { IProjectRepository } from "../../domain/ports/project.repository";
import { Project, ProjectStatus, KeyDecision } from "../../domain/entities/project.entity";

type PrismaProject = {
  id: string; title: string; slug: string; tagline: string;
  techStack: string[]; outcomeMetric: string; status: string;
  featured: boolean; sortOrder: number;
  liveUrl: string | null; githubUrl: string | null; videoUrl: string | null;
  caseStudyPublished: boolean;
  context: string | null; problem: string | null; architectureDiagram: string | null; diagramImageUrl: string | null;
  keyDecisions: unknown; hardParts: string | null; outcome: string | null;
};

@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({ orderBy: { sortOrder: "asc" } });
    return rows.map((r) => this.toDomain(r as PrismaProject));
  }

  async findBySlug(slug: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { slug } });
    return row ? this.toDomain(row as PrismaProject) : null;
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    return row ? this.toDomain(row as PrismaProject) : null;
  }

  async create(data: Omit<Project, "id">): Promise<Project> {
    const { keyDecisions, ...rest } = data;
    const prismaData = { ...rest, keyDecisions: keyDecisions as unknown[] };
    const row = await this.prisma.project.create({
      data: prismaData as unknown as Parameters<typeof this.prisma.project.create>[0]["data"],
    });
    return this.toDomain(row as PrismaProject);
  }

  async update(id: string, data: Partial<Omit<Project, "id">>): Promise<Project> {
    const { keyDecisions, ...rest } = data;
    const prismaData: Record<string, unknown> = { ...rest };
    if (keyDecisions !== undefined) prismaData["keyDecisions"] = keyDecisions as unknown[];
    const row = await this.prisma.project.update({
      where: { id },
      data: prismaData as unknown as Parameters<typeof this.prisma.project.update>[0]["data"],
    });
    return this.toDomain(row as PrismaProject);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  private toDomain(row: PrismaProject): Project {
    return new Project(
      row.id, row.title, row.slug, row.tagline,
      row.techStack, row.outcomeMetric, row.status as ProjectStatus,
      row.featured, row.sortOrder,
      row.liveUrl, row.githubUrl, row.videoUrl,
      row.caseStudyPublished,
      row.context, row.problem, row.architectureDiagram, row.diagramImageUrl,
      (row.keyDecisions ?? []) as KeyDecision[],
      row.hardParts, row.outcome,
    );
  }
}
