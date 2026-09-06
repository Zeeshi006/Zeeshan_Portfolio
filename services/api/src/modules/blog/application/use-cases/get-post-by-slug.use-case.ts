import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BLOG_REPOSITORY, IBlogRepository } from '../../domain/ports/blog-repository.port';
import { BlogPost } from '../../domain/entities/blog-post.entity';

@Injectable()
export class GetPostBySlugUseCase {
  constructor(@Inject(BLOG_REPOSITORY) private readonly repo: IBlogRepository) {}

  async execute(slug: string, adminView = false): Promise<BlogPost> {
    const post = await this.repo.findBySlug(slug);
    if (!post || (!adminView && !post.published)) throw new NotFoundException('Post not found');
    if (!adminView) await this.repo.incrementViews(slug);
    return post;
  }
}
