import { Inject, Injectable } from "@nestjs/common";
import { ISkillRepository, SKILL_REPOSITORY } from "../../domain/ports/skill.repository";
import { Skill } from "../../domain/entities/skill.entity";

@Injectable()
export class GetAllSkillsUseCase {
  constructor(
    @Inject(SKILL_REPOSITORY)
    private readonly skillRepository: ISkillRepository,
  ) {}

  async execute(): Promise<Skill[]> {
    return this.skillRepository.findAll();
  }
}
