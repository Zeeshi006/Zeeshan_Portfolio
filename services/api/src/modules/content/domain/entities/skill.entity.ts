export type SkillCategory = string;

export class Skill {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly category: SkillCategory,
    public readonly proficiencyLevel: number,
    public readonly featured: boolean,
    public readonly sortOrder: number,
  ) {}
}
