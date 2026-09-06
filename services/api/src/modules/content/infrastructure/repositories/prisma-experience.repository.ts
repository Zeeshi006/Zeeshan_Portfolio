import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { IExperienceRepository } from "../../domain/ports/experience.repository";
import { Experience } from "../../domain/entities/experience.entity";

type PrismaExperience = {
  id: string;
  company: string;
  role: string;
  startDate: Date;
  endDate: Date | null;
  summary: string;
  highlights: string[];
  sortOrder: number;
};

@Injectable()
export class PrismaExperienceRepository implements IExperienceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Experience[]> {
    const rows = await this.prisma.experience.findMany({ orderBy: { sortOrder: "asc" } });
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Experience | null> {
    const row = await this.prisma.experience.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(data: Omit<Experience, "id">): Promise<Experience> {
    const row = await this.prisma.experience.create({ data });
    return this.toDomain(row);
  }

  async update(id: string, data: Partial<Omit<Experience, "id">>): Promise<Experience> {
    const row = await this.prisma.experience.update({ where: { id }, data });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.experience.delete({ where: { id } });
  }

  private toDomain(row: PrismaExperience): Experience {
    return new Experience(
      row.id, row.company, row.role, row.startDate,
      row.endDate, row.summary, row.highlights, row.sortOrder,
    );
  }
}
