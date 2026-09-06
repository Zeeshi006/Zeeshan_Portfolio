export class SiteContent {
  constructor(
    public readonly id: string,
    public readonly key: string,
    public readonly value: Record<string, unknown>,
  ) {}
}
