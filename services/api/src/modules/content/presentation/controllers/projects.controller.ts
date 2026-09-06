import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  NotFoundException, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../auth/infrastructure/guards/jwt-auth.guard";
import { PrismaProjectRepository } from "../../infrastructure/repositories/prisma-project.repository";
import { CloudinaryService } from "../../infrastructure/cloudinary.service";
import { CreateProjectDto, ProjectResponseDto, UpdateProjectDto } from "../dtos/project.dto";
import { KeyDecision, Project, ProjectStatus } from "../../domain/entities/project.entity";

@ApiTags("content")
@Controller("content/projects")
export class ProjectsController {
  constructor(
    private readonly repo: PrismaProjectRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ProjectResponseDto] })
  findAll(): Promise<ProjectResponseDto[]> {
    return this.repo.findAll() as unknown as Promise<ProjectResponseDto[]>;
  }

  @Get(":slug")
  @ApiOkResponse({ type: ProjectResponseDto })
  async findOne(@Param("slug") slug: string): Promise<ProjectResponseDto> {
    const item = await this.repo.findBySlug(slug);
    if (!item) throw new NotFoundException();
    return item as unknown as ProjectResponseDto;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.repo.create({
      title: dto.title,
      slug: dto.slug,
      tagline: dto.tagline,
      techStack: dto.techStack,
      outcomeMetric: dto.outcomeMetric,
      status: dto.status as ProjectStatus,
      featured: dto.featured,
      sortOrder: dto.sortOrder,
      liveUrl: dto.liveUrl ?? null,
      githubUrl: dto.githubUrl ?? null,
      videoUrl: dto.videoUrl ?? null,
      caseStudyPublished: dto.caseStudyPublished ?? false,
      context: dto.context ?? null,
      problem: dto.problem ?? null,
      architectureDiagram: dto.architectureDiagram ?? null,
      diagramImageUrl: null,
      keyDecisions: (dto.keyDecisions ?? []) as KeyDecision[],
      hardParts: dto.hardParts ?? null,
      outcome: dto.outcome ?? null,
    }) as unknown as Promise<ProjectResponseDto>;
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@Param("id") id: string, @Body() dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    // Mapped type strips readonly so we can build the patch object imperatively
    const patch: { -readonly [K in keyof Omit<Project, "id">]?: Project[K] } = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.tagline !== undefined) patch.tagline = dto.tagline;
    if (dto.techStack !== undefined) patch.techStack = dto.techStack;
    if (dto.outcomeMetric !== undefined) patch.outcomeMetric = dto.outcomeMetric;
    if (dto.status !== undefined) patch.status = dto.status as ProjectStatus;
    if (dto.featured !== undefined) patch.featured = dto.featured;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.liveUrl !== undefined) patch.liveUrl = dto.liveUrl ?? null;
    if (dto.githubUrl !== undefined) patch.githubUrl = dto.githubUrl ?? null;
    if (dto.videoUrl !== undefined) patch.videoUrl = dto.videoUrl ?? null;
    if (dto.caseStudyPublished !== undefined) patch.caseStudyPublished = dto.caseStudyPublished;
    if (dto.context !== undefined) patch.context = dto.context ?? null;
    if (dto.problem !== undefined) patch.problem = dto.problem ?? null;
    if (dto.architectureDiagram !== undefined) patch.architectureDiagram = dto.architectureDiagram ?? null;
    if (dto.keyDecisions !== undefined) patch.keyDecisions = dto.keyDecisions as KeyDecision[];
    if (dto.hardParts !== undefined) patch.hardParts = dto.hardParts ?? null;
    if (dto.outcome !== undefined) patch.outcome = dto.outcome ?? null;
    return this.repo.update(id, patch) as unknown as Promise<ProjectResponseDto>;
  }

  @Post(":id/diagram")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploadDiagram(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ diagramImageUrl: string }> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundException();
    if (!file) throw new NotFoundException("No file uploaded");
    const url = await this.cloudinary.uploadBuffer(file.buffer, id);
    await this.repo.update(id, { diagramImageUrl: url });
    return { diagramImageUrl: url };
  }

  @Delete(":id/diagram")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteDiagram(@Param("id") id: string): Promise<void> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundException();
    await this.cloudinary.deleteByPublicId(id);
    await this.repo.update(id, { diagramImageUrl: null });
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(@Param("id") id: string): Promise<void> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundException();
    if (item.diagramImageUrl) await this.cloudinary.deleteByPublicId(id);
    await this.repo.delete(id);
  }
}
