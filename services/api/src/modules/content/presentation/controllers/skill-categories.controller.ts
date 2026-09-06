import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../auth/infrastructure/guards/jwt-auth.guard";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { CreateSkillCategoryDto, SkillCategoryResponseDto } from "../dtos/skill-category.dto";

@ApiTags("content")
@Controller("content/skill-categories")
export class SkillCategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: [SkillCategoryResponseDto] })
  async findAll(): Promise<SkillCategoryResponseDto[]> {
    return this.prisma.skillCategory.findMany({ orderBy: { sortOrder: "asc" } });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@Body() dto: CreateSkillCategoryDto): Promise<SkillCategoryResponseDto> {
    return this.prisma.skillCategory.create({ data: dto });
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@Param("id") id: string, @Body() dto: Partial<CreateSkillCategoryDto>): Promise<SkillCategoryResponseDto> {
    const existing = await this.prisma.skillCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    return this.prisma.skillCategory.update({ where: { id }, data: dto });
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(@Param("id") id: string): Promise<void> {
    const existing = await this.prisma.skillCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.skillCategory.delete({ where: { id } });
  }
}
