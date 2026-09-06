import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { BLOG_REPOSITORY, IBlogRepository } from '../../domain/ports/blog-repository.port';
import { BlogPost } from '../../domain/entities/blog-post.entity';
import { SlugService } from '../services/slug.service';
import { ReadingTimeService } from '../services/reading-time.service';

export interface CreatePostInput {
  title: string;
  excerpt: string;
  content: string;
  tags?: string[];
  canonicalUrl?: string;
  slug?: string;
}

@Injectable()
export class CreatePostUseCase {
  constructor(
    @Inject(BLOG_REPOSITORY) private readonly repo: IBlogRepository,
    private readonly slugService: SlugService,
    private readonly readingTime: ReadingTimeService,
  ) {}

  async execute(input: CreatePostInput): Promise<BlogPost> {
    const baseSlug = input.slug ?? input.title;
    const slug = await this.slugService.uniqueSlug(baseSlug, this.repo);

    if (input.slug && await this.repo.slugExists(input.slug)) {
      throw new ConflictException(`Slug "${input.slug}" is already taken`);
    }

    return this.repo.create({
      slug,
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      tags: input.tags ?? [],
      canonicalUrl: input.canonicalUrl,
      readingTime: this.readingTime.compute(input.content),
    });
  }
}
