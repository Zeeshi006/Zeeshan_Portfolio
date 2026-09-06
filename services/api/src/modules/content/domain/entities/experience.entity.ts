export class Experience {
  constructor(
    public readonly id: string,
    public readonly company: string,
    public readonly role: string,
    public readonly startDate: Date,
    public readonly endDate: Date | null,
    public readonly summary: string,
    public readonly highlights: string[],
    public readonly sortOrder: number,
  ) {}
}
