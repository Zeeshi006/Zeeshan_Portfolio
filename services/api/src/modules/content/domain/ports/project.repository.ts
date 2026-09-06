import { Project } from "../entities/project.entity";

export const PROJECT_REPOSITORY = Symbol("PROJECT_REPOSITORY");

export interface IProjectRepository {
  findAll(): Promise<Project[]>;
  findBySlug(slug: string): Promise<Project | null>;
  findById(id: string): Promise<Project | null>;
  create(data: Omit<Project, "id">): Promise<Project>;
  update(id: string, data: Partial<Omit<Project, "id">>): Promise<Project>;
  delete(id: string): Promise<void>;
}
