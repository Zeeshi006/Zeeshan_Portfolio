import { Module } from "@nestjs/common";
import { SKILL_REPOSITORY } from "./domain/ports/skill.repository";
import { PrismaSkillRepository } from "./infrastructure/repositories/prisma-skill.repository";
import { PrismaExperienceRepository } from "./infrastructure/repositories/prisma-experience.repository";
import { PrismaProjectRepository } from "./infrastructure/repositories/prisma-project.repository";
import { PrismaSiteContentRepository } from "./infrastructure/repositories/prisma-site-content.repository";
import { CloudinaryService } from "./infrastructure/cloudinary.service";
import { GetAllSkillsUseCase } from "./application/use-cases/get-all-skills.use-case";
import { SkillsController } from "./presentation/controllers/skills.controller";
import { SkillCategoriesController } from "./presentation/controllers/skill-categories.controller";
import { ExperiencesController } from "./presentation/controllers/experiences.controller";
import { ProjectsController } from "./presentation/controllers/projects.controller";
import { SiteContentController } from "./presentation/controllers/site-content.controller";

@Module({
  controllers: [
    SkillsController,
    SkillCategoriesController,
    ExperiencesController,
    ProjectsController,
    SiteContentController,
  ],
  providers: [
    { provide: SKILL_REPOSITORY, useClass: PrismaSkillRepository },
    GetAllSkillsUseCase,
    PrismaSkillRepository,
    PrismaExperienceRepository,
    PrismaProjectRepository,
    PrismaSiteContentRepository,
    CloudinaryService,
  ],
})
export class ContentModule {}
