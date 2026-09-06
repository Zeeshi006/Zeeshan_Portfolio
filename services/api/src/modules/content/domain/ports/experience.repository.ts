import { Experience } from "../entities/experience.entity";

export const EXPERIENCE_REPOSITORY = Symbol("EXPERIENCE_REPOSITORY");

export interface IExperienceRepository {
  findAll(): Promise<Experience[]>;
  findById(id: string): Promise<Experience | null>;
  create(data: Omit<Experience, "id">): Promise<Experience>;
  update(id: string, data: Partial<Omit<Experience, "id">>): Promise<Experience>;
  delete(id: string): Promise<void>;
}
