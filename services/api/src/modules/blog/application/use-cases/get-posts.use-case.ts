import { Inject, Injectable } from '@nestjs/common';
import { BLOG_REPOSITORY, IBlogRepository, BlogListResult } from '../../domain/ports/blog-repository.port';

@Injectable()
export class GetPostsUseCase {
  constructor(@Inject(BLOG_REPOSITORY) private readonly repo: IBlogRepository) {}

  async execute(page: number, limit: number, tag?: string, adminView = false): Promise<BlogListResult> {
    return this.repo.findAll({ page, limit, tag, publishedOnly: !adminView });
  }
}
