import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../auth/infrastructure/guards/jwt-auth.guard";
import { GetAllSkillsUseCase } from "../../application/use-cases/get-all-skills.use-case";
import { CreateSkillDto, SkillResponseDto } from "../dtos/skill.dto";
import { PrismaSkillRepository } from "../../infrastructure/repositories/prisma-skill.repository";

@ApiTags("content")
@Controller("content/skills")
export class SkillsController {
  constructor(
    private readonly getAllSkills: GetAllSkillsUseCase,
    private readonly repo: PrismaSkillRepository,
  ) {}

  @Get()
  @ApiOkResponse({ type: [SkillResponseDto] })
  async findAll(): Promise<SkillResponseDto[]> {
    const skills = await this.getAllSkills.execute();
    return skills.map((s) => ({
      id: s.id, name: s.name, category: s.category,
      proficiencyLevel: s.proficiencyLevel, featured: s.featured, sortOrder: s.sortOrder,
    }));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreateSkillDto): Promise<SkillResponseDto> {
    return this.repo.create({ ...dto, featured: dto.featured ?? false }) as unknown as Promise<SkillResponseDto>;
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Param("id") id: string, @Body() dto: Partial<CreateSkillDto>): Promise<SkillResponseDto> {
    return this.repo.update(id, dto) as unknown as Promise<SkillResponseDto>;
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(@Param("id") id: string): Promise<void> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundException();
    await this.repo.delete(id);
  }
}
