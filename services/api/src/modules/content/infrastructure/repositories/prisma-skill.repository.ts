import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { ISkillRepository } from "../../domain/ports/skill.repository";
import { Skill, SkillCategory } from "../../domain/entities/skill.entity";

@Injectable()
export class PrismaSkillRepository implements ISkillRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Skill[]> {
    const rows = await this.prisma.skill.findMany({ orderBy: { sortOrder: "asc" } });
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Skill | null> {
    const row = await this.prisma.skill.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(skill: Omit<Skill, "id">): Promise<Skill> {
    const row = await this.prisma.skill.create({
      data: {
        name: skill.name,
        category: skill.category,
        proficiencyLevel: skill.proficiencyLevel,
        featured: skill.featured ?? false,
        sortOrder: skill.sortOrder,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, skill: Partial<Omit<Skill, "id">>): Promise<Skill> {
    const row = await this.prisma.skill.update({ where: { id }, data: skill });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.skill.delete({ where: { id } });
  }

  private toDomain(row: {
    id: string;
    name: string;
    category: string;
    proficiencyLevel: number;
    featured: boolean;
    sortOrder: number;
  }): Skill {
    return new Skill(
      row.id,
      row.name,
      row.category as SkillCategory,
      row.proficiencyLevel,
      row.featured,
      row.sortOrder,
    );
  }
}
