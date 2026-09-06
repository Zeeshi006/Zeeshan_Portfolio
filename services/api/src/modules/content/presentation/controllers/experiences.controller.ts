import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../auth/infrastructure/guards/jwt-auth.guard";
import { PrismaExperienceRepository } from "../../infrastructure/repositories/prisma-experience.repository";
import { CreateExperienceDto, ExperienceResponseDto, UpdateExperienceDto } from "../dtos/experience.dto";
import type { Experience } from "../../domain/entities/experience.entity";

@ApiTags("content")
@Controller("content/experiences")
export class ExperiencesController {
  constructor(private readonly repo: PrismaExperienceRepository) {}

  @Get()
  @ApiOkResponse({ type: [ExperienceResponseDto] })
  async findAll(): Promise<ExperienceResponseDto[]> {
    const items = await this.repo.findAll();
    return items.map(this.toDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@Body() dto: CreateExperienceDto): Promise<ExperienceResponseDto> {
    const item = await this.repo.create({
      company: dto.company,
      role: dto.role,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      summary: dto.summary,
      highlights: dto.highlights,
      sortOrder: dto.sortOrder,
    });
    return this.toDto(item);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@Param("id") id: string, @Body() dto: UpdateExperienceDto): Promise<ExperienceResponseDto> {
    // Entity fields are readonly — use a plain writable type to avoid TS2540
    const patch: {
      company?: string; role?: string; startDate?: Date; endDate?: Date | null;
      summary?: string; highlights?: string[]; sortOrder?: number;
    } = {};
    if (dto.company !== undefined) patch.company = dto.company;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.startDate !== undefined) patch.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) patch.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.summary !== undefined) patch.summary = dto.summary;
    if (dto.highlights !== undefined) patch.highlights = dto.highlights;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    const item = await this.repo.update(id, patch as Parameters<typeof this.repo.update>[1]);
    return this.toDto(item);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(@Param("id") id: string): Promise<void> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundException();
    await this.repo.delete(id);
  }

  private toDto(e: Experience): ExperienceResponseDto {
    return {
      id: e.id,
      company: e.company,
      role: e.role,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate?.toISOString() ?? null,
      summary: e.summary,
      highlights: e.highlights,
      sortOrder: e.sortOrder,
    };
  }
}
