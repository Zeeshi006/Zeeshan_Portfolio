import { Skill } from "../entities/skill.entity";

export const SKILL_REPOSITORY = Symbol("SKILL_REPOSITORY");

export interface ISkillRepository {
  findAll(): Promise<Skill[]>;
  findById(id: string): Promise<Skill | null>;
  create(skill: Omit<Skill, "id">): Promise<Skill>;
  update(id: string, skill: Partial<Omit<Skill, "id">>): Promise<Skill>;
  delete(id: string): Promise<void>;
}
