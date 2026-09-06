export class BlogPost {
  constructor(
    public readonly id: string,
    public readonly slug: string,
    public readonly title: string,
    public readonly excerpt: string,
    public readonly content: string,
    public readonly tags: string[],
    public readonly published: boolean,
    public readonly publishedAt: Date | null,
    public readonly canonicalUrl: string | null,
    public readonly readingTime: number,
    public readonly views: number,
    public readonly kbDocumentId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
