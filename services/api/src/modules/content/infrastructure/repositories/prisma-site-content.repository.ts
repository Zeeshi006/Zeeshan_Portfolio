import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { ISiteContentRepository } from "../../domain/ports/site-content.repository";
import { SiteContent } from "../../domain/entities/site-content.entity";

@Injectable()
export class PrismaSiteContentRepository implements ISiteContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(key: string): Promise<SiteContent | null> {
    const row = await this.prisma.siteContent.findUnique({ where: { key } });
    if (!row) return null;
    return new SiteContent(row.id, row.key, row.value as Record<string, unknown>);
  }

  async upsert(key: string, value: Record<string, unknown>): Promise<SiteContent> {
    // JSON round-trip produces a plain object Prisma's Json type accepts
    const json = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    const row = await this.prisma.siteContent.upsert({
      where: { key },
      create: { key, value: json },
      update: { value: json },
    });
    return new SiteContent(row.id, row.key, row.value as Record<string, unknown>);
  }
}
