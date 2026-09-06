export class KBDocument {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly content: string,
    public readonly metadata: Record<string, unknown>,
    public readonly published: boolean,
    public readonly elevenLabsDocId?: string | null,
  ) {}
}
